# Contributing to mock-xmlhttprequest

## How to contribute code
* Login to GitHub (you need an account).
* Open an issue in the [issue tracker](https://github.com/berniegp/mock-xmlhttprequest/issues).
* Fork the main repository from [GitHub](http://github.com/berniegp/mock-xmlhttprequest).
* Commit your code and tests in your branch.
* Make sure all tests and the lint step pass.
* Push your changes to your fork in GitHub.
* Open a [pull request](https://github.com/berniegp/mock-xmlhttprequest/pulls).
* Wait for a code review and eventual merge by a maintainer.

### Branch contents
For larger changes, organize the commits in your branches logically. Use squash to combine multiple commits, split bigger changes in multiple commits (or pull requests) when relevant, etc. Do what you can to make the reviewer's work easier.

### Dependencies
Don't add more dependencies on external packages unless you have a very good reason to do so. If you do, expect that choice to be scrutinized during the code review.

### Running the unit tests

    $ npm test
    $ npm run lint

All tests must pass and the lint step must have no errors.

## Coding style
The coding style is based on the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) with a few modifications.

In general:
* Be consistent with the existing coding style.
* Avoid overly "clever" code unless there's a compelling reason for it.
* Don't hesitate to comment the code and the reasons behind it.
* Use white space.
