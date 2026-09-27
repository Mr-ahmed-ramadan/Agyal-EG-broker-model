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
}
