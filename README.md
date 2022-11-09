# nachhilfe-backend-expres

## REQUIREMENTS

- NodeJS
- a MySQL database
- an email mailbox you can publish emails from

## CONFIGURATION

All configuration is done using environment variables. We look for a `.env` file in the directory the API is run from for convenience and persistence

| key              | description                                                                  | example value               | fallback |
|------------------|------------------------------------------------------------------------------|-----------------------------|----------|
| `PORT`           | The port the API listens on                                                  | 8080                        | 5001     |
| `DB_HOST`        | Host of a MySQL server                                                       | localhost                   |          |
| `DB_USER`        | The user the API uses to make queries to the database                        | stefanguenther              |          |
| `DB_PASSWORD`    | Password for the database user                                               | sehrgutespasswort           |          |
| `EMAIL_SERVER`   | The address of your chosen email server and port (seperated by `:`)          | `smtp.gmail.com:465`        | :465     |
| `EMAIL_USER`     | A user on your chosen email server the API will use to send emails to people | `noreply@deinemudda.de`     |          |
| `EMAIL_PASSWORD` | Password for the E-Mail account                                              | `irgendeinpassworthalt`     |          |
| `FRONTEND_URL`   | Where the frontend is hosted (for links to click on)                         | `https://nachhilfe.3nt3.de` |          |

## RUNNING (without docker)

After [configuring](#configuration) everything, you can run your server. Check if all [dependencies](#requirements) are running where you specified.

### BUILDING

```
npm run build
```

will basically just run `tsc` to "compile" TypeScript to regular JavaScript

### ACTUALLY RUNNING IT OMG

#### with systemd

There is an [example systemd unit](/tutoring-backend.example.service)

#### just from a terminal

```
node build/index.js
```

## RUNNING (with docker)

This will start a mysql server, phpmyadmin and build the app

```
docker-compose up --build -d app
```
