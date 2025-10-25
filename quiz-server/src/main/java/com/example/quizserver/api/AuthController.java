package com.example.quizserver.api;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AuthController {
    private final JdbcTemplate jdbcTemplate;

    public AuthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");
        var users = jdbcTemplate.query(
                "SELECT id, username, email, role FROM users WHERE username=? AND password=?",
                (rs, i) -> Map.of(
                        "id", rs.getLong("id"),
                        "username", rs.getString("username"),
                        "email", rs.getString("email"),
                        "role", rs.getString("role")
                ),
                username, password
        );
        if (users.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));
        }
        return ResponseEntity.ok(users.get(0));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");
        String email = payload.get("email");
        Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE username=?", Integer.class, username);
        if (exists != null && exists > 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
        }
        jdbcTemplate.update("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'user')", username, password, email);
        var user = jdbcTemplate.queryForMap("SELECT id, username, email, role FROM users WHERE username=?", username);
        return ResponseEntity.ok(user);
    }
}
