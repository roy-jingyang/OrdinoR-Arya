FROM heroku/miniconda:3

RUN conda install --channel conda-forge graphviz
RUN conda install --channel conda-forge ciso8601

# Grab pip requirements.txt
ADD ./requirements.txt /tmp/requirements.txt
# Install dependencies with pip
RUN pip install --upgrade pip
RUN pip install gunicorn
RUN pip install -r /tmp/requirements.txt \
    --index-url https://pypi.org/simple \
    --extra-index-url https://test.pypi.org/simple/ \
    --default-timeout=1000
    #--no-use-pep517


# Add app code
ADD ./arya /opt/OrdinoR-Arya/arya/
ADD ./run.py /opt/OrdinoR-Arya/run.py
WORKDIR /opt/OrdinoR-Arya

CMD gunicorn --bind 0.0.0.0:$PORT 'arya:create_app(demo=True)'
