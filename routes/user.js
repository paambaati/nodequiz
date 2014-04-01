
/*
 * GET login page.
 */

exports.login = function(req, res){
  res.render('login.html', { title: 'Express' });
};