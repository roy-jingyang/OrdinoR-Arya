FROM heroku/heroku

RUN conda install python=3.8
RUN conda install --channel conda-forge graphviz

# Grab pip requirements.txt
ADD ./requirements.txt /tmp/requirements.txt
# Install dependencies with pip
RUN pip install --upgrade pip
RUN pip install gunicorn
RUN pip install -r /tmp/requirements.txt \
    --no-cache-dir \
    --default-timeout=1000

# Add app code
ADD ./arya /opt/OrdinoR-Arya/arya/
ADD ./run.py /opt/OrdinoR-Arya/run.py
WORKDIR /opt/OrdinoR-Arya

CMD gunicorn --bind 0.0.0.0:$PORT 'arya:create_app(demo=True)'
