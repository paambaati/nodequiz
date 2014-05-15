## NodeQuiz

A kickass Quiz app built using NodeJS, Express 4 and MongoDB; designed to be run inside an organization, where users can register and take a quiz everyday. Also features a full-fledged admin interface for adding questions.

### Features

 1. Fully built using the latest stable versions of Node.JS, Express (4.x) and MongoDB.
 2. Beautiful responsive frontend using Bootstrap 3.x and jQuery, including skins.
 3. Standings/Rankings page that shows detailed organization-wide statistics, along with fancy graph charts built using [Flot](http://www.flotcharts.org/ "Flot: Attractive JavaScript plotting for jQuery").
 4. Custom admin interface complete with image upload functionality (for questions) using [DropzoneJS][1] and detailed userbase statistics using [DataTables](http://datatables.net/ "DataTables | Table plug-in for jQuery").
 5. Uses the [`swig`][2] template engine instead of the default `jade`. (That's because I come from Django).
 6. Well-designed responsive templates for all email communication, thanks to [Antwort](http://internations.github.io/antwort/).

### Deployment

Make sure the following packages are installed first.

- [nodejs][3]
- [mongodb][4]
- [nginx][5]

Once these basic packages are installed, DEPLOYMENT TIME!

[pm2][6] is the recommended process wrapper for deploying this app. It is a zero-downtime, automatic-clustering process manager that offers logging, hot-reloading, monitoring and a ton of awesome stuff. Install `pm2` globally using the following command -

```
sudo npm install -g pm2
```

Once installed, simply execute the command -

```
pm2 start app.js -i x
```

where `x` is the maximum number of processor cores available to the app.

For a ridiculously speedy app, also setup `nginx` as a reverse proxy on top of the pm2/node process. Refer the `nginx.conf` file in `config/` for a highly optimized nginx deployment setup.

All other app-specific configuration is present in `config/config.js`.

### Possible areas of improvement

 5. ~~There's a very small level of code smell - most of the routes are still in `app.js`. Pull requests for cleanup are super-welcome.~~ [COMPLETED]
 6. Templates are all plain and are not structured into base/inherited templates.
 7. Could probably use a Grunt or Gulp task runner script for continuous deployment.

### Credits
All versions of the NodeQuiz icon were designed from the wonderful vector icon set from [Brankic1979](http://brankic1979.com/icons/ "Free Icons Set designed by Brankic1979").


  [1]: http://dropzonejs.com/
  [2]: http://paularmstrong.github.io/swig/ "Swig - A Node.js and Browser JavaScript Template Engine"
  [3]: https://github.com/joyent/node/wiki/installation
  [4]: http://docs.mongodb.org/manual/tutorial/install-mongodb-on-red-hat-centos-or-fedora-linux/
  [5]: http://nginx.org/en/linux_packages.html
  [6]: https://github.com/unitech/pm2