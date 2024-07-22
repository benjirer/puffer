import json


def extract_ip_prefixes(file_path):
    with open(file_path, "r") as file:
        data = json.load(file)
    ip_prefixes = []

    if "values" in data:  # for azure structure
        for service in data["values"]:
            if "properties" in service and "addressPrefixes" in service["properties"]:
                ip_prefixes.extend(service["properties"]["addressPrefixes"])
    elif "prefixes" in data:  # for aws structure
        for prefix in data["prefixes"]:
            ip_prefixes.append(prefix["ip_prefix"])

    return ip_prefixes


path1 = "/local/home/bhoffman/puffer/src/portal/puffer/ServiceTags_Public_20240715.json"
path2 = "/local/home/bhoffman/puffer/src/portal/puffer/ip-ranges.json"

# extract IP prefixes from both files
all_ip_prefixes = extract_ip_prefixes(path1) + extract_ip_prefixes(path2)

# save the consolidated list to JSON
with open("ip_prefixes.json", "w") as outfile:
    json.dump({"ip_prefixes": all_ip_prefixes}, outfile, indent=4)
