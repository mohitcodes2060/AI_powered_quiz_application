package com.quizapp.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AIQuizController {

    @GetMapping("/api/quiz/generate")
    public String generateQuiz(@RequestParam String topic) {
        // Placeholder for AI logic to generate a quiz based on the topic
        return "Generated quiz for topic: " + topic;
    }

    // Additional endpoints can be added here
}