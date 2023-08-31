import gzip
import json
import pandas as pd

# open gzip file
with gzip.open('data.json.gz', 'rb') as f:
    # read gzip file
    json_str = f.read()

# json_str is a bytes object, so we need to decode it to a string
json_str = json_str.decode('utf-8')
# parse json string to python dictionary
data = json.loads(json_str)

l = []
events = data['events_per_area']
for event in events:
    l.append((
        event['location_ID'],
        event['start'],
        event['end'],
    ))

df = pd.DataFrame(l, columns=['location_ID', 'start', 'end'])
# sort by start
df = df.sort_values('start')
# reset index
df = df.reset_index(drop=True)
# save to excel
df.to_excel('events.xlsx', index=False)