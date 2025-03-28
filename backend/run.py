import os
import sys
from pathlib import Path

# Add the parent directory to the Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from backend.main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 