# AuraFarm

A database explorer and SQL workbench for development environments. Connect to any JDBC-compatible database, browse schemas, and execute queries through a web UI.

> **WARNING: AuraFarm has zero security. There is no authentication, no authorization, and it executes raw SQL directly against your database. This is SQL injection _by design_. Never expose AuraFarm to the internet or any untrusted network. Use it only in local or isolated development environments.**

## Quick Start

```sh
docker run -p 8080:8080 \
  -e AURAFARM_DB_URL=jdbc:postgresql://host.docker.internal:5432/mydb \
  -e AURAFARM_DB_USERNAME=postgres \
  -e AURAFARM_DB_PASSWORD=postgres \
  ghcr.io/aura3-dev/aurafarm
```

Then open [http://localhost:8080](http://localhost:8080).

## Configuration

AuraFarm is configured via environment variables:

| Variable | Description | Default |
|---|---|---|
| `AURAFARM_DB_URL` | JDBC connection URL | `jdbc:postgresql://localhost:5432/postgres` |
| `AURAFARM_DB_USERNAME` | Database username | `postgres` |
| `AURAFARM_DB_PASSWORD` | Database password | `postgres` |

## Docker Compose Example

```yaml
services:
  aurafarm:
    image: ghcr.io/aura3-dev/aurafarm
    ports:
      - "8080:8080"
    environment:
      AURAFARM_DB_URL: jdbc:postgresql://db:5432/postgres
      AURAFARM_DB_USERNAME: postgres
      AURAFARM_DB_PASSWORD: postgres
    depends_on:
      - db

  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## Adding JDBC Drivers

AuraFarm ships with PostgreSQL support out of the box. To connect to other databases, add the corresponding Quarkus JDBC driver dependency to `pom.xml` and rebuild.

**MySQL:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-mysql</artifactId>
</dependency>
```

**MariaDB:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-mariadb</artifactId>
</dependency>
```

**Microsoft SQL Server:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-mssql</artifactId>
</dependency>
```

**Oracle:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-oracle</artifactId>
</dependency>
```

**H2:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-h2</artifactId>
</dependency>
```

After adding a driver, update `db-kind` in `application.yaml` (or set `QUARKUS_DATASOURCE_DB_KIND` as an env var) and rebuild.

## Building from Source

Requires Java 21+ and Node.js 18+.

```sh
./mvnw package -DskipTests
```

Build the Docker image:

```sh
docker build -f src/main/docker/Dockerfile.jvm -t aurafarm .
```

Run in dev mode with live reload:

```sh
./mvnw quarkus:dev
```

## Deployment

AuraFarm is meant to run alongside your development database — on your local machine, in a dev Docker Compose stack, or in a dev-only Kubernetes namespace. It is a development tool. Do not deploy it to production or any environment accessible to untrusted users.
