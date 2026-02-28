package dev.aura.aurafarm;

import java.sql.Connection;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/query")
public class QueryResource {

    private static final int MAX_ROWS = 1000;

    @Inject
    DataSource dataSource;

    @RegisterForReflection
    public static class QueryRequest {
        public String sql;
        public String schema;
    }

    @RegisterForReflection
    public static class QueryResponse {
        public List<String> columns = new ArrayList<>();
        public List<String> columnTypes = new ArrayList<>();
        public List<List<Object>> rows = new ArrayList<>();
        public String error;

        public static QueryResponse ofError(String message) {
            QueryResponse r = new QueryResponse();
            r.error = message;
            return r;
        }
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public QueryResponse execute(QueryRequest request) {
        if (request == null || request.sql == null || request.sql.isBlank()) {
            return QueryResponse.ofError("SQL query is required");
        }

        try (Connection conn = dataSource.getConnection()) {

            if (request.schema != null && !request.schema.isBlank()) {
                String quoted = "\"" + request.schema.replace("\"", "\"\"") + "\"";
                try (Statement setStmt = conn.createStatement()) {
                    setStmt.execute("SET search_path TO " + quoted);
                }
            }

            Statement stmt = conn.createStatement();
            boolean hasResultSet = stmt.execute(request.sql);

            QueryResponse response = new QueryResponse();

            if (hasResultSet) {
                try (var rs = stmt.getResultSet()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    int colCount = meta.getColumnCount();

                    for (int i = 1; i <= colCount; i++) {
                        response.columns.add(meta.getColumnLabel(i));
                        response.columnTypes.add(meta.getColumnTypeName(i));
                    }

                    int rowCount = 0;
                    while (rs.next() && rowCount < MAX_ROWS) {
                        List<Object> row = new ArrayList<>();
                        for (int i = 1; i <= colCount; i++) {
                            Object val = rs.getObject(i);
                            if (val instanceof org.postgresql.util.PGobject pgo) {
                                row.add(pgo.getValue());
                            } else {
                                row.add(val);
                            }
                        }
                        response.rows.add(row);
                        rowCount++;
                    }
                }
            } else {
                int updateCount = stmt.getUpdateCount();
                response.columns.add("affected_rows");
                List<Object> row = new ArrayList<>();
                row.add(updateCount);
                response.rows.add(row);
            }

            return response;

        } catch (SQLException e) {
            return QueryResponse.ofError(e.getMessage());
        }
    }
}
