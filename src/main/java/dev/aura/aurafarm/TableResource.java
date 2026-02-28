package dev.aura.aurafarm;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/schemas/{schema}/tables")
public class TableResource {

    @RegisterForReflection
    public record ColumnInfo(String name, String type) {}
    @RegisterForReflection
    public record TableInfo(String name, List<ColumnInfo> columns) {}

    @Inject
    DataSource dataSource;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response listTables(@PathParam("schema") String schema) {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();

            List<String> tableNames = new ArrayList<>();
            try (ResultSet rs = meta.getTables(null, schema, null, new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    tableNames.add(rs.getString("TABLE_NAME"));
                }
            }

            List<TableInfo> tables = new ArrayList<>();
            for (String tableName : tableNames) {
                List<ColumnInfo> columns = new ArrayList<>();
                try (ResultSet colRs = meta.getColumns(null, schema, tableName, null)) {
                    while (colRs.next()) {
                        columns.add(new ColumnInfo(
                            colRs.getString("COLUMN_NAME"),
                            colRs.getString("TYPE_NAME")
                        ));
                    }
                }
                tables.add(new TableInfo(tableName, columns));
            }

            return Response.ok(tables).build();
        } catch (SQLException e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }
}
