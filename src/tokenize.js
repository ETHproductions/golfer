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
      maxloop = 10000,
      braces = [0],
      expression = false,
      line = 1,
      col = 1;
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
    tokens.push(new Token(type, stripped, startIndex, endIndex, line, col));
  }
  
  while (code.length && maxloop--) {
    stripped = null;
    
    if (strip(/ |\t/)) {
      addToken("whitespace");
    }
    else if (strip(/\r?\n|\r/)) {
      addToken("line-end");
      line++;
    }

    // Numeric literals: binary, octal, legacy octal, hex, decimal
    else if (es6 && strip(/0b[01]+/i)) {
      addToken("literal");
      expression = true;
    }
    else if (es6 && strip(/0o[0-7]+/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/0\d+/)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/0x[0-9A-F]+/i)) {
      addToken("literal");
      expression = true;
    }
    else if (strip(/(?:\d*\.?\d+|\d+\.?)(?:e[+-]?\d+)?/i)) {
      addToken("literal");
      expression = true;
    }

    // String literals
    else if (strip(/(["'])(?:(?!\1)(?:\\[^]|[^\\\r\n]))*\1/)) {
      addToken("literal");
      expression = true;
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
    else if (es6 && braces[0] === 0 && braces.length > 1 && strip(/\}(?:\\[^]|(?!\$\{)[^\\`])*`/)) {
      addToken("template-end");
      expression = true;
      braces.shift();
    }
    else if (es6 && braces[0] === 0 && braces.length > 1 && strip(/\}(?:\\[^]|(?!\$\{)[^\\`])*\$\{/)) {
      addToken("template-middle");
      expression = false;
    }

    // Values that throw an error when you try to assign something to
    // undefined, Infinity, and NaN cannot be assigned to, but they don't throw an error either
    else if (strip(/(?:false|true|null|this)(?![\w$])/)) {
      addToken("literal");
      expression = false;
    }

    // Taken from http://www.javascripter.net/faq/reserved.htm, but
    // only the ones that cannot be used as variable names in Firefox 54.0a2
    else if (strip(/(?:break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|throw|try|typeof|var|void|while|with)(?![\w$])/)) {
      addToken("keyword");
      expression = false;
    }
    else if (es6 && strip(/(?:await|let|yield)(?![\w$])/)) {
      addToken("keyword");
      expression = false;
    }

    // Valid identifier names (excluding higher Unicode)
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
    else if (strip(/\/\*(?:(?!\*\/)[^])*$/)) {
      throw new SyntaxError("Unterminated comment at index " + startIndex + " (line " + line + ", col " + col + ")");
    }

    // Regexes
    else if (!expression && strip(/\/(?:\\.|\[(?:\\.|[^\]\n\r])+\]|[^\\\/\n\r])+\/[A-Za-z]*/)) {
      addToken("literal");
      expression = true;
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
    else if (strip(/&&|\|\||\+\+|--|(?:!=|==|<<|>>>?|[+\-*\/%&|^<=>])=?|!|~|\?|:|\./)) {
      addToken("operator");
      expression = false;
    }

    // Various other structural components
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
        throw new SyntaxError("Unmatched right-brace at index " + startIndex + " (line " + line + ", col " + col + ")");
      }
    }
    else {
      throw new SyntaxError("Couldn't understand this code: " + code.split(/\r|\n/)[0] + " (line " + line + ", col " + col + ")");
    }
    
    line += stripped.split("\n").length - 1;
    if (stripped.indexOf("\n") > -1) col = stripped.length - stripped.lastIndexOf("\n");
    else col += stripped.length;
  }

  console.log(tokens);
  return tokens;
}

if (typeof window === "undefined") module.exports = tokenize;
