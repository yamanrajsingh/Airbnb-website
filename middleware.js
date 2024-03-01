module.exports.isLogin=(req,res,next)=>{
    if(!req.isAuthenticated())
    {
      req.flash("error","You must be logged in to create listing");
      res.redirect("/login");
    }
    next();
}