import json

# Open and read the JSON file
name = 'fa.mojtabavi.json'
path = '../sources/'
with open(path + name, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Serialize the data with ensure_ascii=False to preserve Persian characters
json_str = json.dumps(data, ensure_ascii=False)

# Save the modified JSON string to a new file
with open(name+'.fixed.json', 'w', encoding='utf-8') as f:
    f.write(json_str)
