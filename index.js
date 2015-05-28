var Glue = require('glue');
var Manifest = require('./manifest');


var composeOptions = {
    relativeTo: __dirname,
    prePlugins: function(server, next){ //here prePlugins register the auth plugin. It's executed before Glue's built-in plugin registration, so by bundling in all plugins on which others may have dependencies onto, all others are safe. This is not the best way to handle dependencies inside plugins' register functions IMHO, just the simplest to set up.

        server.register(require('./server/auth'), function(err){

            if(err){
                return next(err);
            }
            return next();
        });
    }
};


module.exports = Glue.compose.bind(Glue, Manifest.get('/'), composeOptions);
