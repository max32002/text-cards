import json
from pathlib import Path

def align_center_grid_json(file_path: str | Path = "grid.json") -> None:
    path = Path(file_path)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "text_overlay" not in data or not isinstance(data["text_overlay"], dict):
        data["text_overlay"] = {}

    data["text_overlay"]["offset_x"] = 0
    data["text_overlay"]["offset_y"] = 0

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated {path.name}:")
    print(f"  - text_overlay.offset_x: {data['text_overlay']['offset_x']}")
    print(f"  - text_overlay.offset_y: {data['text_overlay']['offset_y']}")

if __name__ == "__main__":
    align_center_grid_json()
