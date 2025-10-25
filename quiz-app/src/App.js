import React, { useState, useEffect } from 'react';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Quiz state management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [aiFeedback, setAiFeedback] = useState('');
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Admin state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userStats, setUserStats] = useState({});

  // Quiz management state
  const [quizzes, setQuizzes] = useState([]);

  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [showQuizEditor, setShowQuizEditor] = useState(false);

  // Users list for admin view
  const [users, setUsers] = useState([]);

  // Helpers
  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/quizzes');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (e) {
      console.error('Failed to fetch quizzes', e);
    }
  };

  const fetchUserHistory = async (userId) => {
    try {
      const res = await fetch(`/api/results/user/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(prev => prev ? { ...prev, quizHistory: data } : prev);
      }
    } catch (e) {
      console.error('Failed to fetch user history', e);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  };

  // Check for existing session on app load
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setShowLogin(false);
      fetchQuizzes();
      fetchUserHistory(user.id);
    } else {
      fetchQuizzes();
    }
  }, []);

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
      }
      return res.json();
    }).then((user) => {
      const normalizedUser = { ...user, quizHistory: [] };
      setCurrentUser(normalizedUser);
      setIsAuthenticated(true);
      setShowLogin(false);
      setLoginError('');
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
      fetchUserHistory(user.id);
      fetchQuizzes();
    }).catch((e) => {
      setLoginError(e.message);
    });
  };

  // Handle registration
  const handleRegister = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    const email = formData.get('email');

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      return res.json();
    }).then((user) => {
      const normalizedUser = { ...user, quizHistory: [] };
      setCurrentUser(normalizedUser);
      setIsAuthenticated(true);
      setShowLogin(false);
      setLoginError('');
      setIsRegistering(false);
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
    }).catch((e) => {
      setLoginError(e.message);
    });
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowLogin(true);
    setShowAdminPanel(false);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizCompleted(false);
    setScore(0);
    setAiFeedback('');
    localStorage.removeItem('currentUser');
  };

  // Save quiz results to user history
  const saveQuizResults = (finalScore, answers, quizId) => {
    const totalQuestions = selectedQuiz ? selectedQuiz.questions.length : answers.length;
    fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, quizId, score: finalScore, totalQuestions })
    }).then(() => {
      fetchUserHistory(currentUser.id);
    }).catch(e => console.error('Failed to save results', e));
  };

  // Handle answer selection
  const handleAnswerSelect = (selectedAnswer) => {
    const newUserAnswers = [...userAnswers, selectedAnswer];
    setUserAnswers(newUserAnswers);

    // Move to next question or complete quiz
    if (currentQuestionIndex < selectedQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Quiz completed - calculate score and get AI feedback
      const finalScore = calculateScore(newUserAnswers);
      setScore(finalScore);
      setQuizCompleted(true);
      saveQuizResults(finalScore, newUserAnswers, selectedQuiz.id);
      generateAIFeedback(newUserAnswers, finalScore);
    }
  };

  // Calculate final score
  const calculateScore = (answers) => {
    let correctCount = 0;
    answers.forEach((answer, index) => {
      if (answer === selectedQuiz.questions[index].correctAnswer) {
        correctCount++;
      }
    });
    return correctCount;
  };

  // Generate AI feedback using Gemini API
  const generateAIFeedback = async (answers, finalScore) => {
    setIsLoadingFeedback(true);
    
    try {
      // Build the prompt for AI feedback
      const wrongAnswers = [];
      const correctAnswers = [];
      
      answers.forEach((answer, index) => {
        const question = selectedQuiz.questions[index];
        if (answer === question.correctAnswer) {
          correctAnswers.push({
            question: question.question,
            userAnswer: answer,
            correctAnswer: question.correctAnswer
          });
        } else {
          wrongAnswers.push({
            question: question.question,
            userAnswer: answer,
            correctAnswer: question.correctAnswer
          });
        }
      });

      const prompt = `You are a friendly and encouraging tutor. The user just completed a quiz and scored ${finalScore} out of ${selectedQuiz.questions.length}.

${wrongAnswers.length > 0 ? `Questions they got wrong:
${wrongAnswers.map(w => `- ${w.question} (They answered: ${w.userAnswer}, Correct answer: ${w.correctAnswer})`).join('\n')}` : 'They got all questions correct!'}

${correctAnswers.length > 0 ? `Questions they got right:
${correctAnswers.map(c => `- ${c.question}`).join('\n')}` : ''}

Please provide a short, encouraging response (2-3 sentences) that:
1. Starts with a positive and encouraging statement
2. Briefly explains the correct answer for one of the questions they got wrong (if any)
3. Congratulates them on a question they got right (if any)

Keep your response friendly, supportive, and educational.`;

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: You'll need to add your API key here
          // 'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const feedback = data.candidates[0].content.parts[0].text;
        setAiFeedback(feedback);
      } else {
        // Fallback feedback if API call fails
        setAiFeedback(`Great job completing the quiz! You scored ${finalScore} out of ${selectedQuiz ? selectedQuiz.questions.length : 0}. Keep up the great work and continue learning!`);
      }
    } catch (error) {
      console.error('Error generating AI feedback:', error);
      // Fallback feedback
      setAiFeedback(`Congratulations on completing the quiz! You scored ${finalScore} out of ${selectedQuiz ? selectedQuiz.questions.length : 0}. Well done!`);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // Reset quiz
  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizCompleted(false);
    setScore(0);
    setAiFeedback('');
    setIsLoadingFeedback(false);
  };

  // Admin functions
  const toggleAdminPanel = () => {
    const next = !showAdminPanel;
    setShowAdminPanel(next);
    if (next) {
      fetchAdminUsers();
    }
  };

  const deleteUser = (userId) => {
    if (userId === currentUser.id) {
      alert('You cannot delete your own account!');
      return;
    }
    setUsers(users.filter(user => user.id !== userId));
  };

  // Quiz management functions
  const createQuiz = (quizData) => {
    const payload = {
      title: quizData.title,
      description: quizData.description,
      createdBy: currentUser.username,
      questions: quizData.questions.map(q => ({ question: q.question, choices: q.choices, correctAnswer: q.correctAnswer }))
    };
    fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to create quiz');
      await fetchQuizzes();
      setShowQuizCreator(false);
      setQuizData({
        title: '',
        description: '',
        questions: [
          { id: 1, question: '', choices: ['', '', '', ''], correctAnswer: '' }
        ]
      });
    }).catch(e => alert(e.message));
  };

  const updateQuiz = (quizId, updatedData) => {
    setQuizzes(quizzes.map(quiz => 
      quiz.id === quizId ? { ...quiz, ...updatedData } : quiz
    ));
    setShowQuizEditor(false);
    setEditingQuiz(null);
  };

  const deleteQuiz = (quizId) => {
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' })
        .then(() => fetchQuizzes())
        .catch(e => alert('Failed to delete quiz'));
    }
  };

  const toggleQuizStatus = (quizId) => {
    fetch(`/api/quizzes/${quizId}/toggle`, { method: 'POST' })
      .then(() => fetchQuizzes())
      .catch(e => alert('Failed to toggle quiz status'));
  };

  const startQuiz = (quiz) => {
    // Ensure we have full quiz with questions
    fetch(`/api/quizzes/${quiz.id}`)
      .then(res => res.json())
      .then(fullQuiz => {
        setSelectedQuiz(fullQuiz);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setQuizCompleted(false);
        setScore(0);
        setAiFeedback('');
      })
      .catch(() => {
        // fallback to provided quiz if fetch fails
        setSelectedQuiz(quiz);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setQuizCompleted(false);
        setScore(0);
        setAiFeedback('');
      });
  };

  // Render login/register form
  const renderAuthForm = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              AI Quiz App
            </h1>
            <p className="text-gray-600">
              {isRegistering ? 'Create your account' : 'Sign in to continue'}
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {loginError}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                />
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors duration-200"
              >
                {isRegistering ? 'Register' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError('');
              }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>

          {!isRegistering && (
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>Demo accounts:</p>
              <p><strong>Admin:</strong> admin / admin123</p>
              <p><strong>User:</strong> user1 / user123</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render admin panel
  const renderAdminPanel = () => {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowQuizCreator(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
            >
              Create Quiz
            </button>
            <button
              onClick={toggleAdminPanel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
            >
              Back to Quiz
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quiz Management */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Quiz Management</h3>
            <div className="space-y-3">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="p-4 bg-white rounded border">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">{quiz.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{quiz.description}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Created by: {quiz.createdBy}</span>
                        <span>•</span>
                        <span>{quiz.questions ? quiz.questions.length : 0} questions</span>
                        <span>•</span>
                        <span className={`px-2 py-1 rounded ${
                          quiz.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {quiz.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setEditingQuiz(quiz);
                          setShowQuizEditor(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleQuizStatus(quiz.id)}
                        className={`text-sm ${
                          quiz.isActive ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {quiz.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteQuiz(quiz.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Management */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">User Management</h3>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="flex justify-between items-center p-3 bg-white rounded border">
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteUser(user.id)}
                    disabled={user.id === currentUser.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Quiz creator state
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    questions: [
      {
        id: 1,
        question: '',
        choices: ['', '', '', ''],
        correctAnswer: ''
      }
    ]
  });

  // Render quiz creator
  const renderQuizCreator = () => {

    const addQuestion = () => {
      setQuizData({
        ...quizData,
        questions: [
          ...quizData.questions,
          {
            id: quizData.questions.length + 1,
            question: '',
            choices: ['', '', '', ''],
            correctAnswer: ''
          }
        ]
      });
    };

    const updateQuestion = (index, field, value) => {
      const updatedQuestions = [...quizData.questions];
      updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
      setQuizData({ ...quizData, questions: updatedQuestions });
    };

    const updateChoice = (questionIndex, choiceIndex, value) => {
      const updatedQuestions = [...quizData.questions];
      updatedQuestions[questionIndex].choices[choiceIndex] = value;
      setQuizData({ ...quizData, questions: updatedQuestions });
    };

    const removeQuestion = (index) => {
      if (quizData.questions.length > 1) {
        const updatedQuestions = quizData.questions.filter((_, i) => i !== index);
        setQuizData({ ...quizData, questions: updatedQuestions });
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (quizData.title && quizData.description && quizData.questions.every(q => q.question && q.choices.every(c => c) && q.correctAnswer)) {
        createQuiz(quizData);
      } else {
        alert('Please fill in all fields');
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create New Quiz</h2>
          <button
            onClick={() => setShowQuizCreator(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Quiz Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quiz Title
              </label>
              <input
                type="text"
                value={quizData.title}
                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quiz title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={quizData.description}
                onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quiz description"
                rows="3"
                required
              />
            </div>

            {/* Questions */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Questions</h3>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Add Question
                </button>
              </div>

              <div className="space-y-6">
                {quizData.questions.map((question, qIndex) => (
                  <div key={qIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-800">Question {qIndex + 1}</h4>
                      {quizData.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text
                        </label>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter question"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Answer Choices
                        </label>
                        <div className="space-y-2">
                          {question.choices.map((choice, cIndex) => (
                            <div key={cIndex} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={choice}
                                onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={`Choice ${cIndex + 1}`}
                                required
                              />
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={question.correctAnswer === choice}
                                onChange={() => updateQuestion(qIndex, 'correctAnswer', choice)}
                                className="ml-2"
                              />
                              <span className="text-sm text-gray-600">Correct</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowQuizCreator(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md"
              >
                Create Quiz
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // Render quiz question
  const renderQuestion = () => {
    const currentQuestion = selectedQuiz.questions[currentQuestionIndex];
    
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {selectedQuiz.questions.length}
              </span>
              <span className="text-sm text-gray-600">
                {Math.round(((currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {currentQuestion.question}
          </h2>

          {/* Answer choices */}
          <div className="space-y-3">
            {currentQuestion.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(choice)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 hover:shadow-md"
              >
                <span className="text-lg text-gray-800">{choice}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render results
  const renderResults = () => {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Score display */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Quiz Complete!
            </h2>
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {score}/{selectedQuiz ? selectedQuiz.questions.length : 0}
            </div>
            <div className="text-xl text-gray-600">
              {selectedQuiz && (
                score === selectedQuiz.questions.length ? "Perfect Score! 🎉" : 
                score >= selectedQuiz.questions.length * 0.7 ? "Great Job! 👍" :
                score >= selectedQuiz.questions.length * 0.5 ? "Good Effort! 💪" : "Keep Learning! 📚"
              )}
            </div>
          </div>

          {/* AI Feedback */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              AI Feedback
            </h3>
            {isLoadingFeedback ? (
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Generating feedback...</span>
              </div>
            ) : (
              <div className="p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-gray-800 leading-relaxed">
                  {aiFeedback}
                </p>
              </div>
            )}
          </div>

          {/* Answer review */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Your Answers
            </h3>
            <div className="space-y-3">
              {selectedQuiz && selectedQuiz.questions.map((question, index) => {
                const userAnswer = userAnswers[index];
                const isCorrect = userAnswer === question.correctAnswer;
                
                return (
                  <div key={question.id} className={`p-4 rounded-lg border ${
                    isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 mb-2">
                          {question.question}
                        </p>
                        <p className="text-sm text-gray-600">
                          Your answer: <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {userAnswer}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-gray-600 mt-1">
                            Correct answer: <span className="font-medium text-green-600">
                              {question.correctAnswer}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="ml-4">
                        {isCorrect ? (
                          <span className="text-green-600 text-2xl">✓</span>
                        ) : (
                          <span className="text-red-600 text-2xl">✗</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset button */}
          <div className="text-center">
            <button
              onClick={resetQuiz}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Take Quiz Again
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render user dashboard
  const renderUserDashboard = () => {
    const activeQuizzes = quizzes.filter(quiz => quiz.isActive);
    
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome, {currentUser.username}!</h2>
              <p className="text-gray-600">Role: {currentUser.role}</p>
            </div>
            <div className="flex space-x-2">
              {currentUser.role === 'admin' && (
                <button
                  onClick={toggleAdminPanel}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Available Quizzes */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Available Quizzes</h3>
              {activeQuizzes.length === 0 ? (
                <p className="text-gray-600">No active quizzes available.</p>
              ) : (
                <div className="space-y-3">
                  {activeQuizzes.map(quiz => (
                    <div key={quiz.id} className="p-4 bg-gray-50 rounded-lg border hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-lg text-gray-800">{quiz.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{quiz.description}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>{quiz.questions ? quiz.questions.length : 0} questions</span>
                            <span>•</span>
                            <span>Created by: {quiz.createdBy}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => startQuiz(quiz)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                        >
                          Start Quiz
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quiz History */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Quiz History</h3>
              {currentUser.quizHistory.length === 0 ? (
                <p className="text-gray-600">No quizzes taken yet. Start your first quiz!</p>
              ) : (
                <div className="space-y-3">
                  {currentUser.quizHistory.slice().reverse().map((quiz, index) => (
                    <div key={quiz.id} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{quiz.quizTitle}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(quiz.date).toLocaleDateString()} - Score: {quiz.score}/{quiz.totalQuestions}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded text-sm ${
                          quiz.score === quiz.totalQuestions ? 'bg-green-100 text-green-800' :
                          quiz.score >= quiz.totalQuestions * 0.7 ? 'bg-blue-100 text-blue-800' :
                          quiz.score >= quiz.totalQuestions * 0.5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {Math.round((quiz.score / quiz.totalQuestions) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main render logic
  if (!isAuthenticated) {
    return renderAuthForm();
  }

  if (showQuizCreator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
        <div className="container mx-auto px-4 py-8">
          {renderQuizCreator()}
        </div>
      </div>
    );
  }

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
        <div className="container mx-auto px-4 py-8">
          {renderAdminPanel()}
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
        <div className="container mx-auto px-4 py-8">
          {renderResults()}
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
        <div className="container mx-auto px-4 py-8">
          {/* Header with user info */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              {selectedQuiz.title}
            </h1>
            <p className="text-white/80 text-lg">
              Welcome, {currentUser.username}! ({currentUser.role})
            </p>
          </div>
          {renderQuestion()}
        </div>
      </div>
    );
  }

  // Default: User dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-8">
        {renderUserDashboard()}
      </div>
    </div>
  );
}

export default App; 