package com.example.quizserver.api;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AdminController {
    private final JdbcTemplate jdbcTemplate;

    public AdminController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/users")
    public ResponseEntity<?> users() {
        List<Map<String, Object>> users = jdbcTemplate.query(
                "SELECT id, username, email, role FROM users ORDER BY id",
                (rs, i) -> Map.of(
                        "id", rs.getLong("id"),
                        "username", rs.getString("username"),
                        "email", rs.getString("email"),
                        "role", rs.getString("role")
                )
        );
        return ResponseEntity.ok(users);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable long id) {
        jdbcTemplate.update("DELETE FROM users WHERE id=?", id);
        return ResponseEntity.noContent().build();
    }
}
