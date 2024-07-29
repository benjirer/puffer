import json


def extract_ip_prefixes(file_path):
    with open(file_path, "r") as file:
        data = json.load(file)
    ip_prefixes = []

    if "values" in data:  # for azure structure
        for service in data["values"]:
            if "properties" in service and "addressPrefixes" in service["properties"]:
                ip_prefixes.extend(service["properties"]["addressPrefixes"])
    elif "prefixes" in data:  # for aws and gcp structure
        for prefix in data["prefixes"]:
            if "ip_prefix" in prefix:
                ip_prefixes.append(prefix["ip_prefix"])
            elif "ipv4Prefix" in prefix:
                ip_prefixes.append(prefix["ipv4Prefix"])
            elif "ipv6Prefix" in prefix:
                ip_prefixes.append(prefix["ipv6Prefix"])

    return ip_prefixes


path1 = "/local/home/bhoffman/puffer/src/ipparser/aws_ip_ranges.json"
path2 = "/local/home/bhoffman/puffer/src/ipparser/azure_ip_ranges.json"
path3 = "/local/home/bhoffman/puffer/src/ipparser/gcp_ip_ranges.json"

# extract IP prefixes from files
all_ip_prefixes = (
    extract_ip_prefixes(path1) + extract_ip_prefixes(path2) + extract_ip_prefixes(path3)
)

# save the list to JSON
with open("blocked_ip_prefixes.json", "w") as outfile:
    json.dump({"blocked_ip_prefixes": all_ip_prefixes}, outfile, indent=4)
