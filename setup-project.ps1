# Create backend folder structure
New-Item -ItemType Directory -Path "backend\app\routers"
New-Item -ItemType File -Path "backend\app\main.py"
New-Item -ItemType File -Path "backend\app\models.py"
New-Item -ItemType File -Path "backend\app\schemas.py"
New-Item -ItemType File -Path "backend\app\crud.py"
New-Item -ItemType File -Path "backend\app\database.py"
New-Item -ItemType File -Path "backend\requirements.txt"
New-Item -ItemType File -Path "backend\Dockerfile"

# Create db folder
New-Item -ItemType Directory -Path "db"
New-Item -ItemType File -Path "db\init.sql"
New-Item -ItemType File -Path "db\Dockerfile"

# Create top-level files
New-Item -ItemType File -Path "docker-compose.yml"
New-Item -ItemType File -Path "README.md"


