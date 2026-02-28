package dev.aura.aurafarm;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/schemas")
public class SchemaResource {

    @Inject
    DataSource dataSource;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listSchemas() {
        List<String> schemas = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getSchemas()) {
                while (rs.next()) {
                    schemas.add(rs.getString("TABLE_SCHEM"));
                }
            }
        } catch (SQLException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
        return Response.ok(schemas).build();
    }
}
