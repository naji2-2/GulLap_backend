/* 퀴즈 api */
const express = require("express");
var db = require("../config/db");

const router = express.Router();

// 오늘 배운 단어 퀴즈
router.get("/today/:user_id", async (req, res) => {

  const { user_id } = req.params;

  const [words] = await db.query(
    `SELECT w.word, w.meaning, w.example
    FROM todo t JOIN words w ON w.id BETWEEN t.word_start_index AND t.word_start_index+3
    WHERE t.todo_date = CURDATE() AND t.user_id = ?`,
    [user_id]
  );

  if (!words || words.length === 0) {
    return res.status(404).json({ error: "오늘 학습한 단어가 없습니다." });
  }

  let quizArr = [];

  const shuffle = (array) => array.sort(() => Math.random() - 0.5);

  for(let i=0; i<words.length; i++){
    const word = words[i];
    const question = words[i].meaning;
    
    const remainwords = words.filter((wrd) => wrd !== word);
  
    // 정답 제외 랜덤으로 단어 3개 선택
    const randomOptions = [];
    while (randomOptions.length < 3) {
      const randIndex = Math.floor(Math.random() * remainwords.length);
      const randomWord = remainwords[randIndex];
  
      if (!randomOptions.includes(randomWord)) {
        randomOptions.push(randomWord);
      }
    }
    
    // 선택지
    const options = [];
    randomOptions.forEach((wrd) => {
      options.push(wrd);
    });
    
    options.push(word);

    const shuffledOptions = shuffle(options); // 섞인 선택지

    quizArr.push({
      word_id: i + 1,
      question: question, // 문제
      options: shuffledOptions, //선택지
      correct_answer: word.word, // 정답
    })
  }

  res.json(shuffle(quizArr));
});

// 배웠던 단어 퀴즈
router.get("/random/:user_id", async (req, res) => {

  const { user_id } = req.params;

  const [words] = await db.query(
    `SELECT w.word, w.meaning, w.example
    FROM todo t JOIN words w ON w.id BETWEEN t.word_start_index AND t.word_start_index+3
    WHERE t.user_id = ?`,
    [user_id]
  );

  if (!words || words.length === 0) {
    return res.status(404).json({ error: "학습한 단어가 없습니다." });
  }

  let quizArr = [];
  let indexArr = [];

  while(quizArr.length < 4){
    const randomIndex = Math.floor(Math.random() * words.length);
    if(indexArr.indexOf(randomIndex) !== -1){
      continue;
    }
    indexArr.push(randomIndex);
    const word = words[randomIndex]; // 정답 단어
    const question = words[randomIndex].meaning;
  
    const remainwords = words.filter((wrd) => wrd !== word);
    
    // 정답 제외 랜덤으로 단어 3개 선택
    const randomOptions = [];
    while (randomOptions.length < 3) {
      const randIndex = Math.floor(Math.random() * remainwords.length);
      const randomWord = remainwords[randIndex];
  
      if (!randomOptions.includes(randomWord)) {
        randomOptions.push(randomWord);
      }
    }

    // 선택지
    const options = [];
    randomOptions.forEach((wrd) => {
      options.push(wrd);
    });

    options.push(word);

    const shuffle = (array) => array.sort(() => Math.random() - 0.5);
    const shuffledOptions = shuffle(options); // 섞인 선택지

    quizArr.push({
      word_id: randomIndex + 1,
      question: question, // 문제
      options: shuffledOptions, //선택지
      correct_answer: word.word, // 정답
    })
  }

  console.log(quizArr);
  res.json(quizArr);
});

// 퀴즈 다 풀었는지
router.post("/complete/:user_id", async (req, res) => {
  
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  try {
    await db.query(
      `INSERT INTO learning_status (user_id, date, quiz_learn)
      VALUES (?, CURDATE(), 1)
      ON DUPLICATE KEY UPDATE quiz_learn = 1`,
      [user_id]
    );
    res.json({ message: "퀴즈 완료 저장됨" });
  } catch (err) {
    console.error("퀴즈 완료 저장 오류:", err);
    res.status(500).json({ error: "퀴즈 완료 저장 실패" });
  }
});

router.post("/randomComplet", async (req, res) => {
  const user_id = req.session.user?.id;

  if (!user_id) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  try {
    await db.query(
      `INSERT INTO randomstatus (user_id, date, random_learn)
      VALUES (?, CURDATE(), 1)
      ON DUPLICATE KEY UPDATE random_learn = 1`,
      [user_id]
    );
    res.json({ message: "퀴즈 완료 저장됨" });
  } catch (err) {
    console.error("퀴즈 완료 저장 오류:", err);
    res.status(500).json({ error: "퀴즈 완료 저장 실패" });
  }
});

router.get("/random-status", async (req, res) => {
  const { user_id } = req.session.user?.id;
  const { date } = req.query;

  if (!user_id || !date) {
    return res.status(400).json({ error: "user_id와 date는 필수입니다." });
  }

  try {
    const [rows] = await db.query(
      `SELECT quiz_learn FROM learning_status WHERE user_id = ? AND date = ?`,
      [user_id, date]
    );
    let quiz_done = 1;
    if (
      !quizResult ||
      quizResult.length === 0 ||
      quizResult[0].quiz_learn == null
    ) {
      quiz_done = 0;
    }
    res.json({ quiz_done });
  } catch (error) {
    console.error("퀴즈 상태 조회 실패:", error);
    res.status(500).json({ error: "서버 오류로 상태를 조회할 수 없습니다." });
  }
});

// 틀린 단어 저장
router.post("/wrong_word/:user_id", async (req, res) => {

  const { user_id } = req.params;
  const { word_id, wrong_word } = req.body;

  try {
    const [wrong_words] = await db.query(`SELECT word_id FROM wrong_words WHERE user_id = ?`, [user_id]);
    const [right_words] = await db.query(`SELECT word_id FROM right_words WHERE user_id = ?`, [user_id]);

    // wrong_words에 저장되어있지 않은 경우에만 저장
    if (wrong_words.filter((item) => item.word_id === word_id).length === 0) {
      await db.query(`INSERT INTO wrong_words (user_id, word_id, word) VALUES(?, ?, ?)`, [user_id, word_id, wrong_word]);
    }

    // right_words에 저장되어있는 경우 삭제
    if (right_words.filter((item) => item.word_id === word_id).length > 0) {
      await db.query(`DELETE FROM right_words WHERE user_id = ? AND word_id = ?`, [user_id, word_id]);
    }

    res.status(200).json("틀린 단어를 저장했습니다!");
  } catch (err) {
    console.error(err);
    res.status(500).send({ err: "Database error" });
  }
});

// 맞은 단어 저장
router.post("/right_word/:user_id", async (req, res) => {

  const { user_id } = req.params;
  const { word_id, right_word } = req.body;

  try {
    const [wrong_words] = await db.query(`SELECT word_id FROM wrong_words WHERE user_id = ?`, [user_id]);
    const [right_words] = await db.query(`SELECT word_id FROM right_words WHERE user_id = ?`, [user_id]);

    // right_words에 저장되어있지 않은 경우에만 저장
    if (right_words.filter((item) => item.word_id === word_id).length === 0) {
      await db.query(`INSERT INTO right_words (user_id, word_id, word) VALUES(?, ?, ?)`, [user_id, word_id, right_word]);
    }

    // wrong_words에 저장되어있는 단어인 경우 wrong_words에서 삭제
    if (wrong_words.filter((item) => item.word_id === word_id).length > 0) {
      await db.query(`DELETE FROM wrong_words WHERE user_id = ? AND word_id = ?`, [user_id, word_id]);
    }

    res.status(200).json("맞은 단어를 저장했습니다!");
  } catch (err) {
    console.error(err);
    res.status(500).send({ err: "Database error" });
  }
});

// 사용자들이 틀린 단어
router.get("/peoples_wrong_word", async (req, res) => {
  try {
    const wrong_word = await db.query(
      `SELECT DISTINCT words.*
      FROM wrong_words JOIN words ON wrong_words.word_id = words.id;`
    );
    const wrong_word_list = wrong_word[0];
    res.status(200).json(wrong_word_list);
  } catch (err) {
    console.error(err);
    res.status(500).send({ err: "Database error" });
  }
});

module.exports = router;
