// For the esversion parameter:
// ES5    -> 5
// ES6    -> 6 or 2015
// ES2016 -> 7 or 2016
// ES2017 -> 2017
// etc.
let tokenize = function(code, esversion = 5) {
  class Token {
    constructor(type, value, start, end, line, col) {
      this.type = type;
      this.value = value;
      this.start = start;
      this.end = end;
      this.line = line;
      this.col = col;
    }
  }
  
  if (esversion === 7) esversion = 2016;

  let orig = code,
      es6 = 6 <= esversion,
      tokens = [],
      stripped = null,
      startIndex = 0,
      endIndex = 0,
      line = 1,
      col = 1,
      maxloop = 10000,
      braces = [0],
      expression = false,
      lastTrueToken = new Token("line-end", "\n", 0, 0, 0, 0),
      newLine = true;
  
  let strip = (regex) => {
    if (code.search(regex) === 0) {
      [stripped] = code.match(regex) || [];
      code = code.slice(stripped.length);
      startIndex = endIndex;
      endIndex += stripped.length;
      return stripped;
    } else {
      return false;
    }
  };
  let addToken = (type) => {
    let token = new Token(type, stripped, startIndex, endIndex, line, col);
    tokens.push(token);
    if (type === "whitespace" || type === "comment") {
      
    }
    else if (type === "line-end") {
      newLine = true;
    }
    else {
      lastTrueToken = token;
      newLine = false;
    }
  }
  let getFilename = () => "input:" + startIndex + "-" + endIndex;
  
  while (code.length && maxloop--) {
    stripped = null;
    let location = " (line " + line + ", col " + col + ")";
    
    // Everything here can be derived from ECMA-262 clause 11:
    // https://tc39.github.io/ecma262/#sec-ecmascript-language-lexical-grammar
    
    // https://tc39.github.io/ecma262/#sec-white-space
    if (strip(/[ \t\v\f]/)) {
      addToken("whitespace");
    }
    // https://tc39.github.io/ecma262/#sec-line-terminators
    else if (strip(/\r?\n|\r/)) {
      addToken("line-end");
    }

    // Numeric literals: binary, octal, legacy octal, hex, decimal
    else if (es6 && strip(/0b[01]+(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if (es6 && strip(/0o[0-7]+(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/0\d+(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/0x[0-9A-F]+(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if ((es6 && strip(/(?:0b[01]+|0o[0-7]+)(?=[A-Z_$])/i)) || strip(/(0\d+|0x[0-9A-F]+)(?=[A-Z_$])/i)) {
      strip(/./);
      throw new SyntaxError("Identifier starts immediately after numeric literal" + location, getFilename());
    }
    else if ((es6 && strip(/(?:0b[01]+|0o[0-7]+)(?=\d)/i)) || strip(/(0\d+|0x[0-9A-F]+)(?=\d)/i)) {
      strip(/./);
      throw new SyntaxError("Numeric literal starts immediately after numeric literal" + location, getFilename());
    }
    else if (es6 && strip(/0b/i)) {
      throw new SyntaxError("Missing binary digits after " + stripped + location, getFilename());
    }
    else if (es6 && strip(/0o/i)) {
      throw new SyntaxError("Missing octal digits after " + stripped + location, getFilename());
    }
    else if (strip(/0x/i)) {
      throw new SyntaxError("Missing hexadecimal digits after " + stripped + location, getFilename());
    }
    else if (strip(/(?:\d*\.\d+|\d+\.?)e[+-]?\d+(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/(?:\d*\.\d+|\d+\.?)e[+-]?\d+/i)) {
      strip(/./);
      throw new SyntaxError("Identifier starts immediately after numeric literal" + location, getFilename());
    }
    else if (strip(/(?:\d*\.\d+|\d+\.?)e/i)) {
      throw new SyntaxError("Missing exponent in scientific literal" + location, getFilename());
    }
    else if (strip(/(?:\d*\.\d+|\d+\.?)(?![\w$])/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/(?:\d*\.\d+|\d+\.?)(?=[\w$])/i)) {
      strip(/./);
      throw new SyntaxError("Identifier starts immediately after numeric literal" + location, getFilename());
    }

    // String literals
    else if (strip(/(["'])(?:(?!\1)(?:\\[^]|[^\\\r\n]))*\1/)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/["'].*/)) {
      throw new SyntaxError("Unfinished string" + location, getFilename());
    }

    // Template literals
    else if (es6 && strip(/`(?:\\[^]|(?!\$\{)[^\\`])*`/)) {
      addToken("template");
      expression = true;
    }
    else if (es6 && strip(/`(?:\\[^]|(?!\$\{)[^\\`])*\$\{/)) {
      addToken("template-start");
      braces.unshift(0);
      expression = false;
    }
    else if (es6 && strip(/`.*/)) {
      throw new SyntaxError("Unfinished template literal" + location, getFilename());
    }
    else if (es6 && braces[0] === 0 && braces.length > 1 && strip(/\}(?:\\[^]|(?!\$\{)[^\\`])*`/)) {
      addToken("template-end");
      expression = true;
      braces.shift();
    }
    else if (es6 && braces[0] === 0 && braces.length > 1 && strip(/\}(?:\\[^]|(?!\$\{)[^\\`])*\$\{/)) {
      addToken("template-middle");
      expression = false;
    }
    else if (es6 && braces[0] === 0 && braces.length > 1 && strip(/\}.*/)) {
      throw new SyntaxError("Unfinished template literal section" + location, getFilename());
    }

    // Values that throw an error when you try to assign something to
    // undefined, Infinity, and NaN cannot be assigned to, but they don't throw an error either
    else if (strip(/(?:false|true|null|this)(?![\w$])/)) {
      addToken("literal");
      expression = true;
    }

    // Taken from http://www.ecma-international.org/ecma-262/5.1/#sec-7.6.1
    else if (lastTrueToken.type !== "period" && strip(/(?:break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|throw|try|typeof|var|void|while|with)(?![\w$])/)) {
      addToken("keyword");
      expression = false;
    }
    // Taken from http://www.ecma-international.org/ecma-262/6.0/#sec-11.6.2
    // Note: let and static *can* be used as identifiers outside of strict mode
    else if (es6 && lastTrueToken.type !== "period" && strip(/(?:await|let|static|yield)(?![\w$])/)) {
      addToken("keyword");
      expression = false;
    }

    // Valid identifier names (excluding higher Unicode and \u{XXXXXX} escapes)
    else if (strip(/(?:\\u00(?:[46][1-9A-F]|[57][0-9A]|24|5F)|[A-Z_$])(?:\\u00(?:3\d|[46][1-9A-F]|[57][0-9A]|24|5F)|[\w$])*/i)) {
      addToken("identifier");
      expression = true;
    }

    // Comments
    else if (strip(/\/\/.*/)) {
      addToken("comment");
    }
    else if (strip(/\/\*(?:(?!\*\/)[^])*\*\//)) {
      addToken("comment");
    }
    else if (strip(/\/\*.*/)) {
      throw new SyntaxError("Unfinished comment" + location, getFilename());
    }
    else if (es6 && newLine && strip(/-->.*/)) {
      addToken("comment");
    }
    else if (es6 && strip(/<!--.*/)) {
      addToken("comment");
    }

    // Regexes
    else if (!expression && strip(/\/(?:\\.|\[(?:\\.|[^\]\n\r])*\]|[^\\\/\n\r])+\/[A-Za-z]*/)) {
      addToken("literal");
      expression = true;
    }
    else if (!expression && strip(/\/.*/)) {
      throw new SyntaxError("Unfinished regular expression" + location, getFilename());
    }
    
    // ES6 Operators
    else if (es6 && strip(/=>|\.\.\./)) {
      addToken("operator");
      expression = false;
    }
    // ES7 Operators
    else if (2016 <= esversion && strip(/\*\*=?/)) {
      addToken("operator");
      expression = false;
    }
    // Operators
    else if (strip(/&&|\|\||\+\+|--|(?:!=|==|<<|>>>?|[+\-*\/%&|^<=>])=?|[!?:~]/)) {
      addToken("operator");
      expression = false;
    }

    // Various other structural components
    else if (strip(/\./)) {
      addToken("period");
      expression = false;
    }
    else if (strip(/,/)) {
      addToken("comma");
      expression = false;
    }
    else if (strip(/;/)) {
      addToken("semicolon");
      expression = false;
    }
    else if (strip(/\(/)) {
      addToken("left-paren");
      expression = false;
    }
    else if (strip(/\)/)) {
      addToken("right-paren");
      expression = true;
    }
    else if (strip(/\[/)) {
      addToken("left-bracket");
      expression = false;
    }
    else if (strip(/\]/)) {
      addToken("right-bracket");
      expression = true;
    }
    else if (strip(/\{/)) {
      braces[0]++;
      addToken("left-brace");
      expression = false;
    }
    else if (strip(/\}/)) {
      if (braces[0] > 0) {
        braces[0]--;
        addToken("right-brace");
        expression = true;
      } else {
        throw new SyntaxError("Unmatched right-brace" + location, getFilename());
      }
    }
    else {
      throw new SyntaxError("Couldn't understand this code: " + code.split(/\r?\n|\r/)[0] + location);
    }
    
    line += stripped.split(/\r?\n|\r/).length - 1;
    if (stripped.indexOf("\n") > -1) col = stripped.length - stripped.lastIndexOf("\n");
    else col += stripped.length;
  }

  console.log(tokens);
  return tokens;
}

if (typeof window === "undefined") module.exports = tokenize;
