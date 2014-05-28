/**
 * Random test-data generation script.
 * Inserts `N` records into Questions collection.
 *
 * EDIT LAST LINE WITH PARAMETERS AND THEN RUN IN MONGO DB CONSOLE.
 *
 * Author: GP.
 * Version: 1.0
 * Release Date: 23-May-2014
 */

// Generate random integer between min and max (both inclusive).
function getRandomInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// Generate random alphanumeric characters of given length.
function getRandomAlphabetsAndNumbers(length) {
    return Math.random().toString(36).substr(2, 11);
}

// Insert sample data into `Questions` collection.
function insertData(dbName, colName, num) {

  var col = db.getSiblingDB(dbName).getCollection(colName);

  for (i = 0; i < num; i++) {
      var rand_choice = getRandomInt(1,4);
      var ran_question = getRandomAlphabetsAndNumbers(getRandomInt(10,400));
      var ran_choice1 = getRandomAlphabetsAndNumbers(getRandomInt(10,40));
      var ran_choice2 = getRandomAlphabetsAndNumbers(getRandomInt(10,40));
      var ran_choice3 = getRandomAlphabetsAndNumbers(getRandomInt(20,40));
      var ran_choice4 = getRandomAlphabetsAndNumbers(getRandomInt(10,40));
      var sample_q_data = {"choices" : {"1" : {"choice_text" : ran_choice1},"2" : {"choice_text" : ran_choice2},"3" : {"choice_text" : ran_choice3},"4" : {"choice_text" : ran_choice4}},"title" : ran_question,"answer" : rand_choice,"allowed_time" : 15,"image_size" : null,"image" : null};
      col.insert(sample_q_data);
  }

  //Print last inserted record's count.
  print(col.count());

}

// Database, collection, number of records to insert.
insertData("quiz_db", "quiz_questions", 100)
