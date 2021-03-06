# HRB Validator

[![npm version](https://badge.fury.io/js/%40davebaol%2Fhrb-validator.svg)](https://badge.fury.io/js/%40davebaol%2Fhrb-validator) [![Build Status](https://travis-ci.org/davebaol/hrb-validator.svg?branch=master)](https://travis-ci.org/davebaol/hrb-validator) [![Codecove](https://codecov.io/github/davebaol/hrb-validator/coverage.svg?precision=0)](https://codecov.io/github/davebaol/hrb-validator) [![dependencies Status](https://david-dm.org/davebaol/hrb-validator/status.svg)](https://david-dm.org/davebaol/hrb-validator) [![devDependencies Status](https://david-dm.org/davebaol/hrb-validator/dev-status.svg)](https://david-dm.org/davebaol/hrb-validator?type=dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Hierarchical Rule-Based Validator is a simple yet powerful data validation engine. Unlike schema-based validation libraries, this framework allows you to compose validation rules in higher order rules to validate complex data structures.

### Major Features
- Both browsers and NodeJS supported
- Validators defined either in code or using JSON/YAML syntax in a declarative way
- Rich set of leaf validators (most from [validator](https://www.npmjs.com/package/validator) and the others implemented internally) to check field values and types
- Branch validators to compose validators in a hierarchical way through:
  - Iterative validation over array elements, object properties and string characters
  - Recursive validation
  - Logical operators
  - Conditional validation
- Widespread support for references in validator arguments and variables:
  - Value references allow you to use variables (in fact constants at the current state of the art) and paths (for instance, to ensure that `maxAge` property has a value greater than the value of `minAge` property)
  - Validator references allow you to reuse user-defined validators, making amongst other things recursion possible

### Upcoming Features
- **User-defined validators with arguments**: user-defined validators will have the same  expressive power of built-in validators.
- **Read/write variables, not just constants**: with adequate support of special setter validators this will make possible even more in-depth validations. For instance, consider the following two scenarios:
  - An object representing a person has an array of relatives and each relative has a flag indicating whether he's a parent or not. You want to check if at most two of the relatives are parents.
  - An object representing an email has an array of attachments and each attachment has a base64 encoded content string. You want to check if the overall size of the attachments is less than a certain threshold.
- **Validation error reporting improvements**: currently, if a validator does not work as expected it's not that easy to identify the actual problem.

### Table of Contents
- [HRB Validator](#hrb-validator)
    - [Major Features](#major-features)
    - [Upcoming Features](#upcoming-features)
    - [Table of Contents](#table-of-contents)
  - [Usage](#usage)
    - [Hard-coded validators](#hard-coded-validators)
    - [Loading validators from file](#loading-validators-from-file)
    - [YAML vs JSON](#yaml-vs-json)
    - [How to use references](#how-to-use-references)
      - [Value reference](#value-reference)
      - [Validator reference](#validator-reference)
    - [Shortcut for optional paths](#shortcut-for-optional-paths)
    - [Union types](#union-types)
  - [Leaf Validators](#leaf-validators)
  - [Branch Validators](#branch-validators)
- [License](#license)

## Usage
Suppose you have the simple object below

```javascript
let toBeValidated = {
  a: {
    b: 1,
    c: true,
    d: ["foo", "bar"]
  }
};
```
and you want to validate it like that:
1. All next rules must be satisfied (logical and)
1. The value at path `a` is an object
1. Paths `a.b` and `a.c` are mutually exclusive (logical xor)
1. The value at path `a.b` is a number (whenever set)
1. The value at path `a.c` is a boolean (whenever set)
1. The value at path `a.d` is an array of strings

By the way, such a validator is expected to fail against the object above, because both paths `a.b` and `a.c` are set, thus breaking rule 3 which in turn breaks rule 1.

Notice that you can easily represent previous rules with the following tree:

![Validation Tree](https://user-images.githubusercontent.com/2366334/56497128-98d2d180-64fc-11e9-8afa-edc624b47dfd.PNG)

<!--
Unfortunately github is not able to render mermaid graphs so we have to use a .png and comment the graph :(

```mermaid
graph TB
1.AND(1. AND)
3.XOR(3. XOR)
1.AND---2(2. The value at path 'a' is an object)
1.AND---3.XOR
3.XOR---3.1(Path 'a.b' is set)
3.XOR---3.2(Path 'a.c' is set)
1.AND---4(4. The value at path 'a.b' is either a number or not specified)
1.AND---5(5. The value at path 'a.c' is either a number or not specified)
1.AND---6(6. The value at path 'a.d' is an array of strings)

2---3.XOR
3.XOR---4
4---5
5---6

linkStyle 7 stroke-width:0px;
linkStyle 8 stroke-width:0px;
linkStyle 9 stroke-width:0px;
linkStyle 10 stroke-width:0px;
```
-->

To create this validator you can choose one of the two approaches described in the following: 
- [Hard-coded Validators](#hard-coded-validators)
- [Loading Validators from File](#loading-validators-from-file)

### Hard-coded validators

This sample code programmatically creates the validator for the previous rules.
```javascript
const V = require("@davebaol/hrb-validator");

// Hard-coded validator
let validator = V.and(              // Rule 1
  V.isType("a", "object"),          //   Rule 2
  V.xor(                            //   Rule 3
    V.isSet("a.b"),                 //     Rule 3.1
    V.isSet("a.c"),                 //     Rule 3.2
  ),
  V.optIsType("a.b", "number"),     //   Rule 4
  V.optIsType("a.c", "boolean"),    //   Rule 5
  V.isArrayOf("a.d", "string")      //   Rule 6
);

// Validate
let vError = validator(toBeValidated);
```
Notice that this is a tree-like structure where`and` and `xor` are **branch validators** made of children that, in turn, are validators.
The others are **leaf validators** with no children.


### Loading validators from file

You use a simple tree-like DSL to define your validator. For instance, our sample validator becomes the *YAML* file below:
```yaml
and:
  - isType: [a, object]
  - xor:
    - isSet: [a.b]
    - isSet: [a.c]
  - optIsType: [a.b, number]
  - optIsType: [a.c, boolean]
  - isArrayOf: [a.d, string]
```
Here each validator is an object with exactly one property where the key is its name and the value is the array of its arguments. They look like, and in fact they are, regular function calls.

For convenience, **leaf validators** are represented as an in-line object, while **branch validators** span multiple lines in a tree-like structure.

To load the validator you can use the sample code below:

```javascript
const fs = require("fs");
const yaml = require("js-yaml");
const ensureValidator = require("@davebaol/hrb-validator/lib/ensure-validator");

// Load validator from file
let vObj = yaml.safeLoad(fs.readFileSync("/path/to/validator/file", 'utf8'));
let validator = ensureValidator(vObj);

// Validate
let vError = validator(toBeValidated);
```


### YAML vs JSON

The choice between *YAML* and *JSON* formats depends on your scenario.

When **human-readability** is important for you, it's recommended to use *YAML* instead of *JSON*. For instance, previous [YAML file](#loading-validators-from-file) converted to JSON, while keeping similar formatting, becomes like this:
```json
{"and": [
	{"isType": ["a", "object"]},
	{"xor": [
		{"isSet": ["a.b"]},
		{"isSet": ["a.c"]}
	]},
	{"optIsType": ["a.b", "number"]},
	{"optIsType": ["a.c", "boolean"]},
	{"isArrayOf": ["a.d", "string"]}
]}
```
So many braces, double quotes and commas! :astonished:
Imagine what would happen for a larger real-world validator. :dizzy_face:

On the other hand, for **machine to machine communication** *JSON* is likely a  more appropriate format. For instance, think of a REST API centralizing configurations and their validators.

### How to use references
A reference is an object with exactly one key amongst `$path` and `$var` whose value is respectively a path to a property of the object to validate and a path to a property of a variable in nested scopes. Notice that reference keys start with `$` to avoid confusion with built-in validators.

There are 2 types of references:

#### Value reference
Value references can be used in any place where a value is expected, for instance a validator argument or a variable definition.
A value reference is either a path reference or a variable reference.
- A **path reference** has the form `{"$path": "path.to.property.of.object.to.validate"}` and returns the value at the specified path for the object under validation  
- A **variable reference** has the form `{"$var": "path.to.property.of.variable.in.nested.scopes"}` and returns the value at the specified path for the first variable with the specified name found in nested scopes from inner to outer. For instance, `{"$var": "record.fields.0"}` returns the value of the first field of the variable with name `record` from nested scopes.

A value reference can be embedded in obect properties and array items. When it's not embedded is called root reference.   

For instance, suppose you have the object below representing a table with an header and an array of rows, where each row is an array of fields.
```json
{
  "header": ["id", "description", "available"],
  "rows": [
    [123, "item 1", true],
    [456, "item 1", false],
    [789, "item 3", true]
  ]
}
```
You want to make sure that each row is an array with a number of fields not greater than the number of fields in the header.
```yaml
def:
  - header: {$path: header} # root reference to the header in the object to validate
    firstFieldName: {$var: header.0}  # root reference (not used, just for the sake of example)

  - every:
    - 'rows'
    - and:
      - isType: [value, array]
      - isLength: [value, {max: {$var: header.length}}]  # embedded reference for the property max
```

#### Validator reference
Validator references can be used only in branch validators for any argument that is expected to be a validator i.e. a child. 
A **validator reference** has the form `{"$var": "$validator_name"}` (It's just a variable whose name starts with `$`) and returns the first validator with the specified name found in nested scopes from inner to outer.

We can rewrite the example above by using a user-defined validator to check each row:
```yaml
def:
  - header: {$path: header} # root reference to the header in the object to validate
    firstFieldName: {$var: header.0}  # root reference (not used, just for the sake of example)
    $checkRow:       # user-defined validator
      and:
        - isType: ['', array]
        - isLength: ['', {max: {$var: header.length}}]  # embedded reference for the property max
  - every:
    - 'rows'
    - call:
      - value
      - {$var: $checkRow}  # validator reference
```

### Shortcut for optional paths

Each validator `xyz(path, ...args)`, no matter whether it is leaf or branch, that takes a path as the first argument has a counterpart validator `optXyz(path, ...args)`:
- **optXyz(path, ...args)**: Check if the value at `path` is not set or passes validator `xyz`.

This shortcut is equivalent to the composite validator
```javascript
  V.or(
    V.not(V.isSet(path)),
    V.xyz(path, ...args)
  )
```
Notice that for a couple of validators the shortcut is somewhat redundant. For instance,
- `V.optIsSet("a")` is always valid, since that path `a` cannot be set and null at the same time
- `V.optIsType("a", "string")` is equivalent to `V.isType("a", ["null", "string"])`

### Union types

Union types are types whose set of values is the union of the value spaces of its member types.
For instance:
- the union type `string|integer|boolean` is the set of all strings, integer numbers and boolean values.
- the union type `null|array` represents an optional array (i.e. array or null)

The second example shows that optional types are union types. This can be done for any type T. You can syntactically represent this as `T?` or `null|T`

Of course for any type T1 and T2 the union types `T1|T2` is equivalent to `T2|T1`.

In practice, union types can be specified in two ways:
- as a pipe separated string, e.g.   `"null|array"`
- as an array of strings, e.g.   `["null", "array"]`

At the moment, you can use union types in validators `isType` and `isArrayOf`. For instance, in YAML
```yaml
and:
  - isType: [a.b.c, [integer, string]]
  - isArrayOf: [s.p.q, integer|string]
```
In the next major release, user-defined validators will support typed arguments. You'll be able to use union types in the declaration of your own validators by specifying name and type of each argument. Also, validator reference will be suppressed and user-defined validators will be invoked just like regular validators.


## Leaf Validators

Here is a list of the leaf validators currently available.

:pushpin: All leaf validators, without exception, have their [shortcut opt](#shortcut-for-optional-paths) (not reported in the table below).

:pushpin: All arguments marked with ♦️ allow you to use a [value reference](#value-reference).

:pushpin: All leaf validators marked with :raised_hand: are not implemented yet, but probably will in the near future.

Leaf Validator                       | Expected Type at `path` | Description
:------------------------------------|:-----------------------:|:--------------------------------------
*contains(path♦️, seed♦️)*             |string| Check if the value at `path` is a string containing the `seed`.
*equals(path♦️, value♦️ [, deep♦️])*    |any   | Check if the value at `path` is equal to the specified `value`.<br/><br/>`deep` is an optional boolean which defaults to `false`. If `deep` is `true`, recursive equality algorithm is performed.<br/><br/>Strict equality `===` is used for comparison regardless of deep mode.
*isAfter(path♦️ [, date])*:raised_hand:|string| Check if the value at `path` is a string representing a date that's after the specified date (defaults to now).
*isAlpha(path♦️ [, locale♦️])*         |string| Check if the value at `path` is a string containing only letters (a-zA-Z).<br/><br/>Locale is one of `['ar', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-MA', 'ar-QA', 'ar-QM', 'ar-SA', 'ar-SD', 'ar-SY', 'ar-TN', 'ar-YE', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-AU', 'en-GB', 'en-HK', 'en-IN', 'en-NZ', 'en-US', 'en-ZA', 'en-ZM', 'es-ES', 'fr-FR', 'hu-HU', 'it-IT', 'ku-IQ', 'nb-NO', 'nl-NL', 'nn-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ru-RU', 'sl-SI', 'sk-SK', 'sr-RS', 'sr-RS@latin', 'sv-SE', 'tr-TR', 'uk-UA']`) and defaults to `en-US`. Locale list is `require('validator').isAlphaLocales`.
*isAlphanumeric(path♦️ [, locale♦️])*  |string| Check if the value at `path` is a string containing only letters and numbers.<br/><br/>Locale is one of `['ar', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-MA', 'ar-QA', 'ar-QM', 'ar-SA', 'ar-SD', 'ar-SY', 'ar-TN', 'ar-YE', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-AU', 'en-GB', 'en-HK', 'en-IN', 'en-NZ', 'en-US', 'en-ZA', 'en-ZM', 'es-ES', 'fr-FR', 'hu-HU', 'it-IT', 'ku-IQ', 'nb-NO', 'nl-NL', 'nn-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ru-RU', 'sl-SI', 'sk-SK', 'sr-RS', 'sr-RS@latin', 'sv-SE', 'tr-TR', 'uk-UA']`) and defaults to `en-US`. Locale list is `require('validator').isAlphanumericLocales`.
*isArrayOf(path♦️, type♦️)*            |array | Check if the value at `path` is an array whose items have either the specified type (if type is a string) or one of the specified types (if type is an array of strings). Supported types are: "array", "boolean", "null", "number", "object", "regex", "string".
*isAscii(path♦️)*                     |string| Check if the value at `path` is a string containing ASCII chars only.
*isBase64(path♦️)*                    |string| Check if the value at `path` is a base64 encoded string.
*isAfter(path♦️ [, date])*:raised_hand: |string| Check if the value at `path` is a string representing a date that's after the specified date (defaults to now).
*isBefore(path♦️ [, date])* :raised_hand: |string| Check if the value at `path` is a string a date that's before the specified date.
*isBoolean(path♦️)* :raised_hand::raised_hand:      |string| Check if a string is a boolean.
*isByteLength(path♦️ [, options♦️])*   |string| Check if the value at `path` is a string whose length (in UTF-8 bytes) falls in the specified range.<br/><br/>`options` is an object which defaults to `{min:0, max: undefined}`.
*isCreditCard(path♦️)*                |string| Check if the value at `path` is a string representing a credit card.
*isAfter(path♦️ [, date])*:raised_hand: |string| Check if the value at `path` is a string representing a date that's after the specified date (defaults to now).
*isDataURI(path♦️)*                   |string| Check if the value at `path` is a string representing a [data uri format](https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs).
*isDecimal(path♦️ [, options♦️])* :raised_hand: |string| Check if the string represents a decimal number, such as 0.1, .3, 1.1, 1.00003, 4.0, etc.<br/><br/>`options` is an object which defaults to `{force_decimal: false, decimal_digits: '1,', locale: 'en-US'}`<br/><br/>`locale` determine the decimal separator and is one of `['ar', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-MA', 'ar-QA', 'ar-QM', 'ar-SA', 'ar-SD', 'ar-SY', 'ar-TN', 'ar-YE', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'en-AU', 'en-GB', 'en-HK', 'en-IN', 'en-NZ', 'en-US', 'en-ZA', 'en-ZM', 'es-ES', 'fr-FR', 'hu-HU', 'it-IT', 'ku-IQ', nb-NO', 'nl-NL', 'nn-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ru-RU', 'sl-SI', 'sr-RS', 'sr-RS@latin', 'sv-SE', 'tr-TR', 'uk-UA']`.<br/>*Note:* `decimal_digits` is given as a range like '1,3', a specific value like '3' or min like '1,'.
*isDivisibleBy(path♦️, divisor♦️)*     |number<br/>string| Check if the value at `path` is a number or a string representing a number that's divisible by the specified `divisor`.
*isEmail(path♦️ [, options♦️])*        |string| Check if the value at `path` is a string representing an email.<br/><br/>`options` is an object which defaults to `{ allow_display_name: false, require_display_name: false, allow_utf8_local_part: true, require_tld: true, allow_ip_domain: false, domain_specific_validation: false }`. If `allow_display_name` is set to true, the validator will also match `Display Name <email-address>`. If `require_display_name` is set to true, the validator will reject strings without the format `Display Name <email-address>`. If `allow_utf8_local_part` is set to false, the validator will not allow any non-English UTF8 character in email address' local part. If `require_tld` is set to false, e-mail addresses without having TLD in their domain will also be matched. If `allow_ip_domain` is set to true, the validator will allow IP addresses in the host part. If `domain_specific_validation` is true, some additional validation will be enabled, e.g. disallowing certain syntactically valid email addresses that are rejected by GMail.
*isEmpty(path♦️ [, options♦️])*        |string| Check if the value at `path` is a string having a length of zero. Contrary to `isLength`, this validator only supports strings.<br/><br/>`options` is an object which defaults to `{ ignore_whitespace:false }`.
*isFloat(path♦️ [, options♦️])*        |number<br/>string| Check if the value at `path` is a number or a string that's a float falling in the specified range.<br/><br/>`options` is an object which can contain the keys `min`, `max`, `gt`, and/or `lt` to validate the float is within boundaries (e.g. `{ min: 7.22, max: 9.55 }`) it also has `locale` as an option.<br/><br/>`min` and `max` are equivalent to 'greater or equal' and 'less or equal', respectively while `gt` and `lt` are their strict counterparts.<br/><br/>`locale` determine the decimal separator and is one of `['ar', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-LY', 'ar-MA', 'ar-QA', 'ar-QM', 'ar-SA', 'ar-SD', 'ar-SY', 'ar-TN', 'ar-YE', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'en-AU', 'en-GB', 'en-HK', 'en-IN', 'en-NZ', 'en-US', 'en-ZA', 'en-ZM', 'es-ES', 'fr-FR', 'hu-HU', 'it-IT', 'nb-NO', 'nl-NL', 'nn-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'ru-RU', 'sl-SI', 'sr-RS', 'sr-RS@latin', 'sv-SE', 'tr-TR', 'uk-UA']`. Locale list is `require('validator').isFloatLocales`.
*isFQDN(path♦️ [, options♦️])*         |string| Check if the value at `path` is a string representing a fully qualified domain name (e.g. domain.com).<br/><br/>`options` is an object which defaults to `{ require_tld: true, allow_underscores: false, allow_trailing_dot: false }`.
*isFullWidth(path♦️)*                 |string| Check if the value at `path` is a string containing any full-width chars.
*isHalfWidth(path♦️)*                 |string| Check if the value at `path` is a string containing any half-width chars.
*isHash(path♦️, algorithm♦️)*          |string| Check if the value at `path` is a string representing a hash of type algorithm.<br/><br/>Algorithm is one of `['md4', 'md5', 'sha1', 'sha256', 'sha384', 'sha512', 'ripemd128', 'ripemd160', 'tiger128', 'tiger160', 'tiger192', 'crc32', 'crc32b']`
*isHexadecimal(path♦️)*               |string| Check if the value at `path` is string representing a hexadecimal number.
*isHexColor(path♦️)*                  |string| Check if the value at `path` is a string representing a hexadecimal color.
*isIdentityCard(path♦️ [, locale♦️])*  |string| Check if the value at `path` is a string representing a valid identity card code.<br/><br/>`locale` is one of `['ES']` OR `'any'`. If 'any' is used, function will Check if any of the locals match.<br/><br/>Defaults to 'any'.
*isInt(path♦️ [, options♦️])*          |number<br/>string| Check if the value at `path` is a number or a string that's an integer falling in the specified range.<br/><br/>`options` is an object which can contain the keys `min` and/or `max` to check the integer is within boundaries (e.g. `{ min: 10, max: 99 }`). `options` can also contain the key `allow_leading_zeroes`, which when set to false will disallow integer values with leading zeroes (e.g. `{ allow_leading_zeroes: false }`). Finally, `options` can contain the keys `gt` and/or `lt` which will enforce integers being greater than or less than, respectively, the value provided (e.g. `{gt: 1, lt: 4}` for a number between 1 and 4).
*isIP(path♦️ [, version♦️])*           |string| Check if the value at `path` is a string representing an IP (version 4 or 6).
*isIPRange(path♦️)*                   |string| Check if the value at `path` is a string representing an IP Range(version 4 only).
*isISBN(path♦️ [, version♦️])*         |string| Check if the value at `path` is a string representing an ISBN (version 10 or 13).
*isISIN(path♦️)*                      |string| Check if the value at `path` is a string representing an [ISIN][ISIN] (stock/security identifier).
*isISO31661Alpha2(path♦️)*            |string| Check if the value at `path` is a string representing a valid [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) officially assigned country code.
*isISO31661Alpha3(path♦️)*            |string| Check if the value at `path` is a string representing a valid [ISO 3166-1 alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) officially assigned country code.
*isISO8601(path♦️)*                   |string| Check if the value at `path` is a string representing a valid [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date; for additional checks for valid dates, e.g. invalidates dates like `2009-02-29`, pass `options` object as a second parameter with `options.strict = true`.
*isISRC(path♦️)*                      |string| Check if the value at `path` is a string representing a [ISRC](https://en.wikipedia.org/wiki/International_Standard_Recording_Code).
*isISSN(path♦️ [, options♦️])*         |string| Check if the value at `path` is a string representing an [ISSN](https://en.wikipedia.org/wiki/International_Standard_Serial_Number).<br/><br/>`options` is an object which defaults to `{ case_sensitive: false, require_hyphen: false }`. If `case_sensitive` is true, ISSNs with a lowercase `'x'` as the check digit are rejected.
*isJSON(path♦️)*                      |string| Check if the value at `path` is a string representing valid JSON (note: uses JSON.parse).
*isJWT(path♦️)*                       |string| Check if the value at `path` is a string representing valid JWT token.
*isLatLong(path♦️)*                   |array<br/>string| Check if the value at `path` represents a valid latitude-longitude coordinate in one of the following formats:<br/>&#8226; *array* -> `[lat, long]` where items can be either a string or a number<br/>&#8226; *string* -> `"lat,long"` or `"lat, long"`
*isLength(path♦️ [, options♦️])*       |object<br/>array<br/>string| Check if the value at `path` is a string, an array or an object whose length falls in the specified range.<br/><br/>`options` is an object which defaults to `{min:0, max: undefined}`.
*isLowercase(path♦️)*                 |string| Check if the value at `path` is a string in lowercase.
*isMACAddress(path♦️)*                |string| Check if the value at `path` is a string representing a MAC address.<br/><br/>`options` is an object which defaults to `{no_colons: false}`. If `no_colons` is true, the validator will allow MAC addresses without the colons.
*isMagnetURI(path♦️)*                 |string| Check if the value at `path` is a string representing a [magnet uri format](https://en.wikipedia.org/wiki/Magnet_URI_scheme).
*isMD5(path♦️)*                       |string| Check if the value at `path` is a string representing a MD5 hash.
*isMimeType(path♦️)*                  |string| Check if the string matches to a valid [MIME type](https://en.wikipedia.org/wiki/Media_type) format
*isMobilePhone(path♦️ [, locale♦️ [, options♦️]])* |string| Check if the value at `path` is a string representing a mobile phone number,<br/><br/>(locale is either an array of locales (e.g `['sk-SK', 'sr-RS']`) OR one of `['ar-AE', 'ar-DZ', 'ar-EG', 'ar-IQ', ar-JO', 'ar-KW', 'ar-SA', 'ar-SY', 'ar-TN', 'be-BY', 'bg-BG', 'bn-BD', 'cs-CZ', 'de-DE', 'da-DK', 'el-GR', 'en-AU', 'en-CA', 'en-GB', 'en-GH', 'en-HK', 'en-IE', 'en-IN',  'en-KE', 'en-MU', en-NG', 'en-NZ', 'en-RW', 'en-SG', 'en-UG', 'en-US', 'en-TZ', 'en-ZA', 'en-ZM', 'en-PK', 'es-ES', 'es-MX', 'es-UY', 'et-EE', 'fa-IR', 'fi-FI', 'fr-FR', 'he-IL', 'hu-HU', 'id-ID', 'it-IT', 'ja-JP', 'kk-KZ', 'ko-KR', 'lt-LT', 'ms-MY', 'nb-NO', 'nn-NO', 'pl-PL', 'pt-PT', 'pt-BR', 'ro-RO', 'ru-RU', 'sl-SI', 'sk-SK', 'sr-RS', 'sv-SE', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN', 'zh-CN', 'zh-HK', 'zh-TW']` OR defaults to 'any'. If 'any' or a falsey value is used, function will Check if any of the locales match).<br/><br/>`options` is an optional object that can be supplied with the following keys: `strictMode`, if this is set to `true`, the mobile phone number must be supplied with the country code and therefore must start with `+`. Locale list is `require('validator').isMobilePhoneLocales`.
*isMongoId(path♦️)*                   |string| Check if the value at `path` is a string representing a valid hex-encoded representation of a [MongoDB ObjectId][mongoid].
*isMultibyte(path♦️)*                 |string| Check if the value at `path` is a string containing one or more multibyte chars.
*isNumeric(path♦️ [, options♦️])*      |string| Check if the value at `path` is a string containing only numbers.<br/><br/>`options` is an object which defaults to `{no_symbols: false}`. If `no_symbols` is true, the validator will reject numeric strings that feature a symbol (e.g. `+`, `-`, or `.`).
*isOneOf(path♦️, values♦️)*            |any   | Check if the value at `path` belongs to the specified array of values. Internally strict equality is used to compare values.
*isPort(path♦️)*                      |number<br/>string| Check if the value at `path` is either a string or a number representing a valid port.
*isPostalCode(path♦️, locale♦️)*       |string| Check if the value at `path` is a string representing a postal code,<br/><br/>(locale is one of `[ 'AD', 'AT', 'AU', 'BE', 'BG', 'CA', 'CH', 'CZ', 'DE', 'DK', 'DZ', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IL', 'IN', 'IS', 'IT', 'JP', 'KE', 'LI', 'LT', 'LU', 'LV', 'MX', 'NL', 'NO', 'PL', 'PT', 'RO', 'RU', 'SA', 'SE', 'SI', 'TN', 'TW', 'UA', 'US', 'ZA', 'ZM' ]` OR 'any'. If 'any' is used, function will Check if any of the locals match. Locale list is `require('validator').isPostalCodeLocales`.).
*isRFC3339(path♦️)*                   |string| Check if the value at `path` is a string representing a valid [RFC 3339](https://tools.ietf.org/html/rfc3339) date.
*isSet(path♦️)*                       |any   | Check if the value at `path` is a non null value.
*isSurrogatePair(path♦️)*             |string| Check if the value at `path` is a string containing any surrogate pairs chars.
*isType(path♦️, type♦️)*               |any   | Check if the value at `path` has either the specified type (if type is a string) or one of the specified types (if type is an array of strings). Supported types are: "array", "boolean", "null", "number", "object", "regex", "string".
*isUppercase(path♦️)*                 |string| Check if the value at `path` is a string in uppercase.
*isURL(path♦️ [, options♦️])*          |string| Check if the value at `path` is a string representing an URL.<br/><br/>`options` is an object which defaults to `{ protocols: ['http','https','ftp'], require_tld: true, require_protocol: false, require_host: true, require_valid_protocol: true, allow_underscores: false, host_whitelist: false, host_blacklist: false, allow_trailing_dot: false, allow_protocol_relative_urls: false, disallow_auth: false }`.
*isUUID(path♦️ [, version♦️])*         |string| Check if the value at `path` is a string representing a UUID (version 3, 4 or 5).
*isVariableWidth(path♦️)*             |string| Check if the value at `path` is a string containing a mixture of full and half-width chars.
*isWhitelisted(path♦️, chars♦️)*       |string| Checks if the value at `path` is a string containing only the characters in the whitelist.
*matches(path♦️, pattern♦️ [, modifiers♦️])* |string| Check if the value at `path` is a string matching the pattern.<br/><br/>Either `matches('foo', /foo/i)` or `matches('foo', 'foo', 'i')`.

## Branch Validators

Here is a list of the branch validators currently available.

:pushpin: Only branch validators taking a `path` as first argument, i.e. the ones not having a :heavy_multiplication_x: in the second column, have a [shortcut opt](#shortcut-for-optional-paths) (not reported in the table below).

:pushpin: All arguments marked with ♣️ allow you to use a [validator reference](#validator-reference).

:pushpin: All arguments marked with ♦️ allow you to use a [value reference](#value-reference).

Branch Validator               | Expected Type at `path`| Description
:------------------------------|:----------------------:|:------------------------------------
*alter(res1♦️, res2♦️, child♣️)*  |:heavy_multiplication_x:| If `child` child is valid `res1` is returned; `res2` otherwise.<br/>**Note:** Any `null` result is mapped to `undefined`, i.e. success. This allows you to force success also from JSON where `undefined` is not supported.
*and(...children♣️)*            |:heavy_multiplication_x:| Check if all its children are valid. Validation fails at the first non valid child and succeeds if all children are valid.
*call(path♦️, child️️️♣️)*          | any                    | Validate `child` against the value at the specified path.
*def(scope️️, child️️️♣️)*           | any                    | Define a scope containing variables and validators (the latter ones having a name that starts with `$`) that the `child` and all his descendants can reach via a `$var` reference. See [How to use references](#how-to-use-references)
*every(path♦️, child♣️)*         |object<br/>array<br/>string| Validate `child` for the items of the value at `path`, which must be an array, an object or a string. Validation fails at the first non valid item and succeeds if all items are valid. The object against which `child` is validated depends on the type of the value at `path`:<br/>&#8226; *array* -> `{index: <iteration_index>, value: <item_at_index>, original: <original_object>}`<br/>&#8226; *object* -> `{index: <iteration_index>, key: <property_key>, value: <property_value>, original: <original_object>}`<br/>&#8226; *string* -> `{index: <iteration_index>, value: <char_at_index>, original: <original_object>}`
*if(cond♣️, then♣️ [, else♣️])*   |:heavy_multiplication_x:| If `cond` child is valid validates `then` child; `else` child otherwise (if present). It always succeeds when `cond` child is not valid and `else` child is not specified. This validator is useful, for instance, when the value of a property depends on the value of another property.
*not(child♣️)* <img width=800/> |:heavy_multiplication_x:| Check if the negation of its child is valid.
*onError(result♦️, child♣️)*     |:heavy_multiplication_x:| Force the specified result if its child is non valid.<br/>**Note:** A `null` result is mapped to `undefined`, i.e. success. This allows you to force success also from JSON where `undefined` is not supported.
*or(...children♣️)*             |:heavy_multiplication_x:| Check if at least one child is valid. Validation succeeds at the first valid child and fails if all children are non valid.
*some(path♦️, child♣️)*          |object<br/>array<br/>string| Validate `child` for the items of the value at `path`, which must be either an array or an object. Validation succeeds at the first valid item and fails if all items are non valid. The object aginst with `child` is validated depends on the type of the value at `path`:<br/>&#8226; *array* -> `{index: <iteration_index>, value: <item_at_index>, original: <original_object>}`<br/>&#8226; *object* -> `{index: <iteration_index>, key: <property_key>, value: <property_value>, original: <original_object>}`<br/>&#8226; *string* -> `{index: <iteration_index>, value: <char_at_index>, original: <original_object>}`
*while(path♦️, cond♣️, do♣️)*     |object<br/>array<br/>string| Validate `cond` and `do` children for the items of the value at `path`, which must be an array, an object or a string. Validation fails as soon as the condition fails and succeeds if the condition succeeds for all items. At each iteration `do` child is validated only after `cond` child succeeds. After each `do` validation, either success or failure counter is increased accordingly. The object against which `cond` and `do` children are validated depends on the type of the value at `path`:<br/>&#8226; *array* -> `{index: <iteration_index>, value: <item_at_index>, succeeded: <how_many_times_do_succeeded>, failed: <how_many_times_do_failed>, original: <original_object>}`<br/>&#8226; *object* -> `{index: <iteration_index>, key: <property_key>, value: <property_value>, succeeded: <how_many_times_do_succeeded>, failed: <how_many_times_do_failed>, original: <original_object>}`<br/>&#8226; *string* -> `{index: <iteration_index>, value: <char_at_index>, succeeded: <how_many_times_do_succeeded>, failed: <how_many_times_do_failed>, original: <original_object>}`
*xor(...children♣️)*            |:heavy_multiplication_x:| Check if exactly one child is valid. Validation fails at the second valid child or when all children are processed an no child was valid. Validation succeeds when all children are processed and exactly one child was valid.

# License

MIT © Davide Sessi
