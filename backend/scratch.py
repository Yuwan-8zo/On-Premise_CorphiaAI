import urllib.request
import re

try:
    req = urllib.request.Request('https://abetlen.github.io/llama-cpp-python/whl/cpu/llama-cpp-python/')
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
    matches = re.findall(r'href=[\'\"]?([^\'\" >]+cp312[^\'\" >]+win_amd64[^\'\" >]+)[\'\"]?', html)
    print("\n".join(matches))
except Exception as e:
    print(f"Error: {e}")
