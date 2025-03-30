from setuptools import setup, find_packages

setup(
    name="project-oversight",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.109.2",
        "uvicorn==0.27.1",
        "python-dotenv==1.0.1",
        "openai==1.12.0",
        "websockets==12.0",
        "supabase==2.3.4",
        "pydantic==2.6.1",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "python-multipart==0.0.9",
    ],
    python_requires=">=3.10",
) 