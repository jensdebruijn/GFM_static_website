import json
from base64 import b64encode
from requests import post

import os

POSTGRESQL_HOST = '127.0.0.1'
POSTGRESQL_PORT = 5432
POSTGRESQL_USER = 'postgres'
POSTGRESQL_PASSWORD = 'ikbenhet'

ELASTIC_HOST = 'http://127.0.0.1:9200'

TWITTER_DEV = {
    'TWITTER_CONSUMER_KEY': 'j7Sgpg6gsEoKcWklkKVwN2go3',
    'TWITTER_CONSUMER_SECRET': 'bqvj2DVHEfvUFWiy11tInJxwX3qn7mmi95WOpakYsMPLUIqcQL',
    'TWITTER_ACCESS_TOKEN': '928934147057508352-IHaQTAs3Uqrqj4QWoQ0MwoMGdZ6qrpZ',
    'TWITTER_ACCESS_TOKEN_SECRET': 'fe9379IW0fqA5QMQ2KveCAaVL8o8Qg4iH2Mj1ACul7dXm',
}

def _get_access_token():
    if os.path.exists('access_token'):
        with open('access_token', 'r') as f:
            return f.read().strip()
    bearer_token = f"{TWITTER_DEV['TWITTER_CONSUMER_KEY']}:{TWITTER_DEV['TWITTER_CONSUMER_SECRET']}"
    encoded_bearer_token = b64encode(bearer_token.encode('ascii')).decode('utf-8')
    request = post(
        'https://api.twitter.com/oauth2/token',
        headers={
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Authorization': 'Basic {}'.format(encoded_bearer_token)
        },
        data='grant_type=client_credentials'.encode('ascii'))
    access_token = json.loads(request.text)['access_token']
    with open('access_token', 'w') as f:
        f.write(access_token)
    return access_token

ACCESS_TOKEN = _get_access_token()
