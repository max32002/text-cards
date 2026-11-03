# 使用方法：
# 1. 使用預設的 grid.json 檔案執行：
#    python script.py
# 2. 指定自訂的 JSON 檔案執行：
#    python script.py custom_grid.json

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

def update_grid_json(file_path: str | Path = "grid.json") -> None:
    path = Path(file_path)
    
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    today = datetime.now()
    today_compact = today.strftime("%Y%m%d")
    today_hyphen = today.strftime("%Y-%m-%d")

    data["output_filename"] = f"grid_{today_compact}"

    if "text_overlay" in data and "title" in data["text_overlay"]:
        title = data["text_overlay"]["title"]
        if re.search(r"\d{4}[-/]\d{2}[-/]\d{2}", title):
            data["text_overlay"]["title"] = re.sub(r"\d{4}[-/]\d{2}[-/]\d{2}", today_hyphen, title)
        else:
            data["text_overlay"]["title"] = f"{title}\n{today_hyphen}"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated {path.name}:")
    print(f"  - output_filename: {data.get('output_filename')}")
    print(f"  - title: {repr(data.get('text_overlay', {}).get('title'))}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update grid json file.")
    parser.add_argument("file_path", nargs="?", default="grid.json", help="Path to the grid json file")
    args = parser.parse_args()
    update_grid_json(args.file_path)