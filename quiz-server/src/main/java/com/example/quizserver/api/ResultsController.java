package com.example.quizserver.api;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/results")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class ResultsController {
    private final JdbcTemplate jdbcTemplate;

    public ResultsController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> payload) {
        long userId = ((Number) payload.get("userId")).longValue();
        long quizId = ((Number) payload.get("quizId")).longValue();
        int score = ((Number) payload.get("score")).intValue();
        int totalQuestions = ((Number) payload.get("totalQuestions")).intValue();
        jdbcTemplate.update("INSERT INTO quiz_results (user_id, quiz_id, score, total_questions) VALUES (?, ?, ?, ?)", userId, quizId, score, totalQuestions);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> byUser(@PathVariable long userId) {
        List<Map<String, Object>> results = jdbcTemplate.query(
                "SELECT qr.id, qr.quiz_id, q.title as quiz_title, qr.score, qr.total_questions, qr.created_at FROM quiz_results qr JOIN quizzes q ON q.id=qr.quiz_id WHERE qr.user_id=? ORDER BY qr.created_at DESC",
                (rs, i) -> Map.of(
                        "id", rs.getLong("id"),
                        "quizId", rs.getLong("quiz_id"),
                        "quizTitle", rs.getString("quiz_title"),
                        "score", rs.getInt("score"),
                        "totalQuestions", rs.getInt("total_questions"),
                        "date", rs.getTimestamp("created_at").toInstant().toString()
                ), userId
        );
        return ResponseEntity.ok(results);
    }
}
