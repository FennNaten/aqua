var Async = require('async');
var Config = require('../config');


exports.register = function (server, options, next) {

    //this register function uses values set by hapi-mongo-model, and the cookie scheme. 
    //those needs to be registered before this one. In this approach, we will register them all here, and then register this plugin at prePlugins via glue.
    //this way, all the dependencies will be bundled here and registered before any other plugin

    var modelsConfig = {
        mongodb: Config.get('/hapiMongoModels/mongodb'),
        models: {
            Account: './server/models/account',
            AdminGroup: './server/models/admin-group',
            Admin: './server/models/admin',
            AuthAttempt: './server/models/auth-attempt',
            Session: './server/models/session',
            Status: './server/models/status',
            User: './server/models/user'
        },
        autoIndex: Config.get('/hapiMongoModels/autoIndex')
    }
    var dependencies = [require('hapi-auth-basic'), require('hapi-auth-cookie'), { register: require('hapi-mongo-models'), options: modelsConfig} ];
    
    server.register(dependencies, function(err){

        if(err) {
            return next(err);
        }

        var Session = server.plugins['hapi-mongo-models'].Session;
        var User = server.plugins['hapi-mongo-models'].User;


        server.auth.strategy('session', 'cookie', {
            password: Config.get('/cookieSecret'),
            cookie: 'sid-aqua',
            isSecure: false,
            redirectTo: '/login',
            validateFunc: function (data, callback) {

                Async.auto({
                    session: function (done) {

                        var id = data.session._id;
                        var key = data.session.key;
                        Session.findByCredentials(id, key, done);
                    },
                    user: ['session', function (done, results) {

                        if (!results.session) {
                            return done();
                        }

                        User.findById(results.session.userId, done);
                    }],
                    roles: ['user', function (done, results) {

                        if (!results.user) {
                            return done();
                        }

                        results.user.hydrateRoles(done);
                    }],
                    scope: ['user', function (done, results) {

                        if (!results.user || !results.user.roles) {
                            return done();
                        }

                        done(null, Object.keys(results.user.roles));
                    }]
                }, function (err, results) {

                    if (err) {
                        return callback(err);
                    }

                    if (!results.session) {
                        return callback(null, false);
                    }

                    callback(null, Boolean(results.user), results);
                });
            }
        });


        next();

    });
};


exports.preware = {};


exports.preware.ensureAdminGroup = function (groups) {

    return {
        assign: 'ensureAdminGroup',
        method: function (request, reply) {

            if (Object.prototype.toString.call(groups) !== '[object Array]') {
                groups = [groups];
            }

            var groupFound = groups.some(function (group) {

                return request.auth.credentials.roles.admin.isMemberOf(group);
            });

            if (!groupFound) {
                var response = {
                    message: 'Permission denied to this resource.'
                };

                return reply(response).takeover().code(403);
            }

            reply();
        }
    };
};


exports.register.attributes = {
    name: 'auth'
};
