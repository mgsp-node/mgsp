FROM node:21

ENV PORT=25565

RUN mkdir -p /app/src/config

WORKDIR /app

ADD package.json /app
ADD src/config /app/src/config
ADD src/classes /app/src/classes
ADD src/genfavico.js /app/src
ADD src/mgsp.js /app/src

RUN apt-get update
RUN apt-get upgrade -y

RUN chmod +x src/genfavico.js
RUN mv src/genfavico.js /usr/local/bin/genfavico

EXPOSE $PORT

CMD [ "npm", "start" ]
