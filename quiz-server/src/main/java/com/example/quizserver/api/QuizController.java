package com.example.quizserver.api;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.PreparedStatement;
import java.sql.Statement;

import java.util.*;

@RestController
@RequestMapping("/api/quizzes")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class QuizController {
    private final JdbcTemplate jdbcTemplate;

    public QuizController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        var quizzes = jdbcTemplate.query("SELECT id, title, description, created_by, is_active FROM quizzes",
                (rs, i) -> Map.of(
                        "id", rs.getLong("id"),
                        "title", rs.getString("title"),
                        "description", rs.getString("description"),
                        "createdBy", rs.getString("created_by"),
                        "isActive", rs.getBoolean("is_active")
                ));
        return ResponseEntity.ok(quizzes);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable long id) {
        var quiz = jdbcTemplate.queryForMap("SELECT id, title, description, created_by, is_active FROM quizzes WHERE id=?", id);
        var questions = jdbcTemplate.query("SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer FROM questions WHERE quiz_id=? ORDER BY id",
                (rs, i) -> Map.of(
                        "id", rs.getLong("id"),
                        "question", rs.getString("question_text"),
                        "choices", List.of(rs.getString("choice_a"), rs.getString("choice_b"), rs.getString("choice_c"), rs.getString("choice_d")),
                        "correctAnswer", rs.getString("correct_answer")
                ), id);
        Map<String, Object> response = new HashMap<>(quiz);
        response.put("questions", questions);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> payload) {
        String title = (String) payload.get("title");
        String description = (String) payload.get("description");
        String createdBy = (String) payload.get("createdBy");
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO quizzes (title, description, created_by, is_active) VALUES (?, ?, ?, TRUE)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, title);
            ps.setString(2, description);
            ps.setString(3, createdBy);
            return ps;
        }, keyHolder);
        Long quizId = keyHolder.getKey() != null ? keyHolder.getKey().longValue() : null;
        List<Map<String, Object>> questions = (List<Map<String, Object>>) payload.get("questions");
        for (Map<String, Object> q : questions) {
            jdbcTemplate.update(
                    "INSERT INTO questions (quiz_id, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    quizId,
                    q.get("question"),
                    ((List<?>) q.get("choices")).get(0),
                    ((List<?>) q.get("choices")).get(1),
                    ((List<?>) q.get("choices")).get(2),
                    ((List<?>) q.get("choices")).get(3),
                    q.get("correctAnswer")
            );
        }
        return ResponseEntity.ok(Map.of("id", quizId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        jdbcTemplate.update("DELETE FROM quizzes WHERE id=?", id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable long id) {
        jdbcTemplate.update("UPDATE quizzes SET is_active = NOT is_active WHERE id=?", id);
        return ResponseEntity.ok().build();
    }
}
