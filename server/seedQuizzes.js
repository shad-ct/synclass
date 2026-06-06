/**
 * @fileoverview Seed script to populate 3 different types of sample quiz sets in MongoDB.
 * Run with: node seedQuizzes.js
 */
const mongoose = require('mongoose');
const QuizSet = require('./models/QuizSet');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/synclass';

const sampleQuizSets = [
  {
    title: '🌐 Web Development Basics',
    questions: [
      {
        text: 'What does HTML stand for?',
        options: [
          'Hyper Text Markup Language',
          'Hyperlinks and Text Markup Language',
          'Home Tool Markup Language',
          'Hyper Tool Multi Language'
        ],
        correctIndex: 0,
        timeLimit: 20
      },
      {
        text: 'Which CSS property is used to control the size of text?',
        options: [
          'font-style',
          'text-size',
          'font-size',
          'text-style'
        ],
        correctIndex: 2,
        timeLimit: 15
      },
      {
        text: 'How do you write "Hello World" in an alert box in JavaScript?',
        options: [
          'alertBox("Hello World");',
          'msg("Hello World");',
          'alert("Hello World");',
          'msgBox("Hello World");'
        ],
        correctIndex: 2,
        timeLimit: 20
      }
    ]
  },
  {
    title: '🚀 Space & Science Trivia',
    questions: [
      {
        text: 'Which planet in our solar system is known as the "Red Planet"?',
        options: [
          'Venus',
          'Mars',
          'Jupiter',
          'Saturn'
        ],
        correctIndex: 1,
        timeLimit: 15
      },
      {
        text: 'What is the approximate speed of light?',
        options: [
          '150,000 km/s',
          '300,000 km/s',
          '500,000 km/s',
          '1,000,000 km/s'
        ],
        correctIndex: 1,
        timeLimit: 20
      },
      {
        text: 'Which gas is the most abundant in Earth\'s atmosphere?',
        options: [
          'Oxygen',
          'Carbon Dioxide',
          'Nitrogen',
          'Hydrogen'
        ],
        correctIndex: 2,
        timeLimit: 15
      }
    ]
  },
  {
    title: '🧠 General Knowledge & Trivia',
    questions: [
      {
        text: 'How many bones are there in the adult human body?',
        options: [
          '186',
          '206',
          '226',
          '246'
        ],
        correctIndex: 1,
        timeLimit: 20
      },
      {
        text: 'In which year did the Titanic passenger liner sink?',
        options: [
          '1905',
          '1912',
          '1918',
          '1923'
        ],
        correctIndex: 1,
        timeLimit: 15
      },
      {
        text: 'Who painted the famous artwork "Mona Lisa"?',
        options: [
          'Vincent van Gogh',
          'Pablo Picasso',
          'Leonardo da Vinci',
          'Claude Monet'
        ],
        correctIndex: 2,
        timeLimit: 20
      }
    ]
  }
];

const seedDB = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    // Clear existing quiz sets
    await QuizSet.deleteMany({});
    console.log('🧹 Cleared existing quiz sets.');

    // Insert sample quiz sets
    await QuizSet.insertMany(sampleQuizSets);
    console.log('✨ Successfully seeded 3 sample quiz sets!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err.message);
    process.exit(1);
  }
};

seedDB();
