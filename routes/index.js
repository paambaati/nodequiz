
/*
 * GET pages.
 */

exports.index = function(req, res){
  res.render('index.html', { title: 'Welcome', user: req.user });
};

exports.login = function(req, res){
  res.render('login.html', { title: 'Login' });
};
