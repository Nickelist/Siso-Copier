window.Siso = window.Siso || {};

Siso.Extractor = {
  getLinkDensity: function (el) {
    const links = el.getElementsByTagName("a");
    const textLength = el.textContent.length;
    let linkLength = 0;
    for (let i = 0; i < links.length; i++) {
      linkLength += links[i].textContent.length;
    }
    return textLength === 0 ? 0 : linkLength / textLength;
  },

  cleanNode: function (el, tag) {
    const targetList = el.getElementsByTagName(tag);
    for (let i = targetList.length - 1; i >= 0; i--) {
      targetList[i].parentNode.removeChild(targetList[i]);
    }
  },

  getBodyTextFallback: function () {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName;
          if (
            [
              "SCRIPT",
              "STYLE",
              "NOSCRIPT",
              "IFRAME",
              "OBJECT",
              "HEAD",
              "NAV",
              "FOOTER",
              "ASIDE",
              "BUTTON",
            ].includes(tag)
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          const props = (parent.className + " " + parent.id).toLowerCase();
          if (
            /(menu|nav|footer|header|social|share|sidebar|popup|modal|cookie)/.test(
              props
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node.nodeValue.trim());
    }
    return textNodes.join(" ").replace(/\s+/g, " ").trim();
  },

  getAllPageContent: function () {
    const data = this.getArticleData();
    return data.text;
  },

  getArticleData: function () {
    try {
      const paragraphs = document.getElementsByTagName("p");
      const candidates = new Map();

      const getScore = (el) => candidates.get(el) || 0;
      const setScore = (el, score) => candidates.set(el, score);
      const addToScore = (el, points) =>
        candidates.set(el, (candidates.get(el) || 0) + points);

      const scoreProps = (el) => {
        let score = 0;
        const props = (el.className + " " + el.id).toLowerCase();
        if (
          /(article|body|content|entry|hentry|main|page|pagination|post|text|blog|story)/.test(
            props
          )
        )
          score += 5;
        if (
          /(comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget|header|nav|menu|social)/.test(
            props
          )
        )
          score -= 25;
        return score;
      };

      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const text = p.textContent;
        if (text.length < 25) continue;

        const parent = p.parentNode;
        const grandparent = parent.parentNode;

        if (!candidates.has(parent)) {
          setScore(parent, scoreProps(parent));
          addToScore(parent, 10);
        }
        if (grandparent && !candidates.has(grandparent)) {
          setScore(grandparent, scoreProps(grandparent));
          addToScore(grandparent, 5);
        }

        let contentScore = 1;
        contentScore += text.split(",").length;
        contentScore += Math.min(Math.floor(text.length / 100), 3);

        addToScore(parent, contentScore);
        if (grandparent) addToScore(grandparent, contentScore / 2);
      }

      let topCandidate = null;
      let maxScore = 0;

      for (const [el, score] of candidates.entries()) {
        const linkDensity = this.getLinkDensity(el);
        const finalScore = score * (1 - linkDensity);
        candidates.set(el, finalScore);
        if (finalScore > maxScore) {
          maxScore = finalScore;
          topCandidate = el;
        }
      }

      if (!topCandidate || maxScore < 20) {
        const fallbackText = this.getBodyTextFallback();
        return {
          title: document.title,
          text: fallbackText,
          html: document.body.innerHTML, // Fallback HTML
          url: window.location.href,
        };
      }

      console.log(
        "Top candidate found:",
        topCandidate.tagName,
        topCandidate.className,
        "Score:",
        maxScore
      );

      const clone = topCandidate.cloneNode(true);
      const tagsToRemove = [
        "script",
        "style",
        "noscript",
        "iframe",
        "object",
        "button",
        "input",
        "select",
        "textarea",
        "nav",
        "footer",
        "header",
        "aside",
      ];
      tagsToRemove.forEach((tag) => this.cleanNode(clone, tag));

      const allElements = clone.getElementsByTagName("*");
      for (let i = allElements.length - 1; i >= 0; i--) {
        const el = allElements[i];
        const props = (el.className + " " + el.id).toLowerCase();
        if (
          /(share|social|related|sidebar|advert|promo|sponsor|newsletter|subscribe|comment|meta|tags)/.test(
            props
          )
        ) {
          el.parentNode.removeChild(el);
        }
      }

      return {
        title: document.title,
        text: clone.textContent.replace(/\s+/g, " ").trim(),
        html: clone.innerHTML,
        url: window.location.href,
      };
    } catch (error) {
      console.error("Error in getArticleData:", error);
      return {
        title: document.title,
        text: this.getBodyTextFallback(),
        html: document.body.innerHTML,
        url: window.location.href,
      };
    }
  },
};
