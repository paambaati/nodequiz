NodeQuiz
========

A kickass Quiz app built using NodeJS, Express 4 and MongoDB; designed to be run inside an organization, where users can register and take a quiz everyday. Also features a full-fledged admin interface for adding questions.

**Features**

 1. Fully built using the latest stable versions of Node.JS, Express (4.x) and MongoDB.
 2. Beautiful frontend using Bootstrap 3.x and jQuery 2.x, including skins.
 3. Custom admin interface complete with image upload functionality.
 4. Uses the `[swig][1]` template engine instead of the default `jade`. (That's because I come from Django).

**Deployment**

Refer the `nginx.conf` file in `config/` for optimum deployment tips. 

> MORE TO BE ADDED HERE

**Areas of improvement**

 5. There's a very small level of code smell - most of the routes are still in `app.js`. Pull requests for cleanup are super-welcome.
 6. Templates are all plain and are not structured into base/inherited templates.
 7. Could probably use a Grunt or Gulp task runner script for continuous deployment.

  [1]: http://paularmstrong.github.io/swig/ "Swig - A Node.js and Browser JavaScript Template Engine"
