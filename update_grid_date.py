import json
import re
from datetime import datetime
from pathlib import Path

def update_grid_json(file_path: str | Path = "grid.json") -> None:
    path = Path(file_path)
    
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    today = datetime.now()
    today_compact = today.strftime("%Y%m%d")      # e.g., 20260901
    today_hyphen = today.strftime("%Y-%m-%d")     # e.g., 2026-09-01

    # Update output_filename: grid_YYYYMMDD
    data["output_filename"] = f"grid_{today_compact}"

    # Update title: replace existing date format (YYYY-MM-DD or YYYY/MM/DD) or append if not present
    if "text_overlay" in data and "title" in data["text_overlay"]:
        title = data["text_overlay"]["title"]
        # Match YYYY-MM-DD or YYYY/MM/DD
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
    update_grid_json()
