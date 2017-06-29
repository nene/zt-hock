const Request = require('../lib/request');

describe('Request unit tests', function() {
    describe("matching", function() {

        it('should work with defined headers in the incoming request', function() {
            const request = new Request({}, {
                method: 'GET',
                url: '/lowercasetest',
                headers: { 'foo-type': 'artischocke' }
            });

            expect(request).toEqual(expect.objectContaining({
                method: 'GET',
                url: '/lowercasetest',
                headers: { 'foo-type': 'artischocke' }
            }));
        });

        it('should work with defined headers in the incoming request', function() {
            const request = new Request({}, {
                method: 'GET',
                url: '/lowercasetest',
                headers: { 'foo-type': 'artischocke' }
            });

            expect(request).toEqual(expect.objectContaining({
                method: 'GET',
                url: '/lowercasetest',
                headers: {'foo-type': 'artischocke'}
            }));
        });
    });
});
