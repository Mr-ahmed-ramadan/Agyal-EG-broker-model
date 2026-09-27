package eg.agyal.fixgateway;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.Test;

class DatabaseTest {

    @Test
    void convertsRenderStyleUrlsToJdbc() {
        assertArrayEquals(
                new String[] {"jdbc:postgresql://dpg-abc.oregon-postgres.render.com:5432/agyal", "agyal_user", "p@ss:w/rd"},
                Database.fromPostgresUrl("postgresql://agyal_user:p%40ss%3Aw%2Frd@dpg-abc.oregon-postgres.render.com/agyal"));
    }

    @Test
    void keepsPortAndSslButDropsPrismaSchema() {
        assertArrayEquals(
                new String[] {"jdbc:postgresql://localhost:6543/db?sslmode=require", "u", "p"},
                Database.fromPostgresUrl("postgres://u:p@localhost:6543/db?schema=public&sslmode=require"));
    }

    @Test
    void acceptsNeonUrls() {
        assertArrayEquals(
                new String[] {"jdbc:postgresql://ep-cool-rain-a1b2c3.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require",
                        "neondb_owner", "npg_secret"},
                Database.fromPostgresUrl("postgresql://neondb_owner:npg_secret@ep-cool-rain-a1b2c3.eu-central-1.aws.neon.tech"
                        + "/neondb?sslmode=require&channel_binding=require"));
    }
}
