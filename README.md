# tutoring-backend-express

Backend für die Nachhilfeplattform der SV am GymHaan.

# start

## in development mode
In this mode phpmyadmin is also started on port 8000

There is a helper script `dev.sh` which accepts arguments just as docker-compose would just adding `-f docker-compose-dev.html` before everything so the alternative docker-compose file is used.


```
./dev.sh up app
```

## in production mode
```
docker-compose --build -d app 
```