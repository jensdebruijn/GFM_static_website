import time
import json
from psycopg2.extensions import AsIs
from collections import deque
from types import GeneratorType
from itertools import chain, islice
from requests import post
import gzip

import sanitize

from postgresql import PostgreSQL    
from elastic import Elastic

from config import ACCESS_TOKEN

strict_table_name = 'floods_strict'
es_index = "gfm"


pg = PostgreSQL('gfm')
pg.create_aggregates()

es = Elastic()

def chunker(iterable, size):
    if isinstance(iterable, (GeneratorType, chain, zip)):
        iterator = iter(iterable)
        for first in iterator:
            yield chain([first], islice(iterator, size - 1))
    else:
        for pos in range(0, len(iterable), size):
            yield iterable[pos:pos + size]

class LastTweetsDeque(deque):
    def __init__(self, *args, **kwargs):
        deque.__init__(self, *args, **kwargs)

    def clean_text(self, text, clean_text=sanitize.clean_text):
        return clean_text(text, lower=True)

    def ngramify(
        self,
        cleaned_text,
        tokenize=sanitize.tokenize,
        gramify=sanitize.gramify
    ):
        tokens = tokenize(cleaned_text, remove_punctuation=True)
        if len(tokens) < 5:
            return (" ".join(tokens),)
        else:
            return tuple(gramify(tokens, 5, 5, remove_tokens_with_punctuation=False))

    def text_to_ngrams(self, text):
        return self.ngramify(self.clean_text(text))

    def is_similar_to(self, *, text=None, clean_text=None, ngrams=None):
        if not ngrams:
            if not clean_text:
                clean_text = self.clean_text(text)
            ngrams = self.ngramify(clean_text)
        else:
            ngrams = tuple(ngrams)
        for ngrams_in_deque in self:
            if any(ngram in ngrams_in_deque for ngram in ngrams):
                self.remove(ngrams_in_deque)
                deque.appendleft(self, ngrams_in_deque)
                return True
        else:
            self.appendleft(ngrams)
            return False

    def appendleft(self, value):
        deque.appendleft(self, value)
        if len(self) > 100:
            self.pop()


def call_api(url):
    while True:
        request = post(url, headers={'Authorization': f'Bearer {ACCESS_TOKEN}'})
        tweets = json.loads(request.text)
        if 'errors' in tweets:
            print(tweets['errors'])
            time.sleep(60)
        else:
            return tweets

def request_tweets(start, stop, kind, location_ID, max_tweets, media=False, n_hits=False, check_twitter=True, filter_classes=False):
    if kind in ('0', 'city'):
        if start:
            query = es.build_date_query(start, stop, locations=True, filter_countries=location_ID, filter_classes=filter_classes)
        else:
            query = es.build_query(locations=True, filter_countries=location_ID, filter_classes=filter_classes)
    elif kind == '1':
        if start:
            query = es.build_date_query(start, stop, locations=True, filter_within_adm1=location_ID, filter_classes=filter_classes)
        else:
            query = es.build_query(locations=True, filter_within_adm1=location_ID, filter_classes=filter_classes)
    elif kind == 'additional_relation':
        if start:
            query = es.build_date_query(start, stop, locations=True, filter_additional_relations=location_ID, filter_classes=filter_classes)
        else:
            query = es.build_query(locations=True, filter_additional_relations=location_ID, filter_classes=filter_classes)
    elif kind.startswith('subbasin'):
        if start:
            query = es.build_date_query(start, stop, locations=True, filter_subbasins=(int(kind[9:]), location_ID), filter_classes=filter_classes)
        else:
            query = es.build_query(locations=True, filter_subbasins=location_ID, filter_classes=filter_classes)
    else:
        raise NotImplementedError
    query.update({
        '_source': ['text', 'date', 'locations']
    })
    tweets = {}
    last_tweets = LastTweetsDeque()
    n = 0
    for tweet in es.scroll_through(index=es_index, body=query, raise_on_error=False):
        ID, tweet = tweet['_id'], tweet['_source']
        if not last_tweets.is_similar_to(text=tweet['text']):
            parsed_tweet = {
                'text': tweet['text'],
                'date': tweet['date'].isoformat(),
                # 'locations': tweet['locations'],
                'id': ID
            }
            tweets[ID] = parsed_tweet
            n += 1
            if max_tweets and n >= max_tweets:
                break

    bottom_message = None
    if check_twitter:
        available_tweets = []
        for chunk in chunker(list(tweets.keys()), 100):
            url = f'https://api.twitter.com/1.1/statuses/lookup.json?id={",".join([ID[2:] for ID in chunk])}'
            for tweet in call_api(url):
                if media and 'media' in tweet['entities']:
                    available_tweet = tweets['t-' + tweet['id_str']]
                    available_tweet.update(
                        {'media': tweet['entities']['media'][0]['media_url_https']}
                    )
                    available_tweets.append(
                        available_tweet
                    )
                else:
                    available_tweets.append(tweets['t-' + tweet['id_str']])
    
    n_tweets = es.n_hits(index=es_index, body=query)     
    if not bottom_message:
        available_tweets = [tweet for tweet in tweets.values()]
        if len(available_tweets) == 0:
            bottom_message = 'No tweets can be shown. They may be deleted by the user'
        elif len(available_tweets) == n_tweets:
            bottom_message = None
        elif len(available_tweets) < max_tweets:
            bottom_message = '(Near-) duplicate or deleted tweets are not displayed here'
        else:
            bottom_message = 'Too many tweets to display here'
    return available_tweets, n_tweets, bottom_message

pg.cur.execute("""
    SELECT
        %s.location_ID,
        event_id,
        first_doc,
        LEAST(latest_doc + interval '1 day', current_timestamp at time zone 'UTC'),
        childs
    FROM %s
""", (AsIs(strict_table_name), AsIs(strict_table_name)))
res = pg.cur.fetchall()
pg.conn.commit()

events = []
if res:
    affected_areas = set()
    for i, event in enumerate(res):
        events.append({
            'location_ID': event[0],
            'event_id': event[1],
            'start': event[2].isoformat(),
            'end': event[3].replace(microsecond=0).isoformat(),
            'childs': event[4],
        })
        affected_areas.add(event[0])

    pg.cur.execute("""
        SELECT
            simple_geoms.location_ID,
            simple_geoms.geom,
            level,
            full_name
        FROM simple_geoms
        JOIN locations
        ON simple_geoms.location_ID = locations.location_ID
        WHERE locations.location_ID IN %s
    """, (tuple(affected_areas), ))
    areas = {
        location_ID: {
            "properties": {
                "type": str(level),
                "location_ID": location_ID,
                "full_name": full_name
            },
            "geometry": json.loads(geom)
        } for location_ID, geom, level, full_name in pg.cur.fetchall()
    }
    pg.conn.commit()
else:
    areas = {}

for i, event in enumerate(events):
    if not i % 100:
        print(i, len(events))
    tweets = request_tweets(
        event['start'],
        event['end'],
        areas[event['location_ID']]['properties']['type'],
        event['location_ID'],
        100,
        media=True,
        n_hits=False,
        check_twitter=True,
        filter_classes=False
    )
    event['tweets'] = tweets

json_str = json.dumps({
        'events_per_area': events,
        'areas': areas
    })
# save to json string to gzip
with gzip.open('data.json.gz', 'wb') as f:
    f.write(json_str.encode('utf-8'))