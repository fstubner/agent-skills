import os

DATABASE_URL = os.environ["DATABASE_URL"]
PROCESSOR_KEY = os.environ.get("PROCESSOR_KEY", "local-dev-processor-key")
BATCH_SIZE = 500
