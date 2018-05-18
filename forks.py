import re

hooks = '''
   (F₀ F₁) X₁ = X₁ F₀ (F₁ X₁)
X₀ (F₀ F₁) X₁ = X₀ F₀ (F₁ X₁)
'''

forks = '''
   (F₀ F₁ F₂) X₁ =    (F₀ X₁) F₁    (F₂ X₁)
X₀ (F₀ F₁ F₂) X₁ = (X₀ F₀ X₁) F₁ (X₀ F₂ X₁)

   (X₂ F₁ F₂) X₁ =     X₂     F₁    (F₂ X₁)
X₀ (X₂ F₁ F₂) X₁ =     X₂     F₁ (X₀ F₂ X₁)
'''

subs = '₀₁₂₃'
vars = 'FX'

def replace(s):
    fs = [
        (r'(.+)=(.+)'        , r'<span class="lhs">\1</span><span class="rhs">\2</span>'),
        (r'(.+)'             , r'<div class="equation">\1</div>'),
        (r'\('               , '<span class="grouping">'),
        (r'\)'               , '</span>'),
        (r'(([FX])([₀₁₂₃]))' , r'<span class="\2">\1</span>'),
        (r'\n\n'             , r'<br />'),
        ]
    cur = s
    for patt, repl in fs:
        cur = re.sub(patt, repl, cur)
    return cur

fmt = '<div><h1>{}</h1><div>{}</div></div>'
styles = '''
body {}
.equation {
    font-family: monospace;
    font-size: 20px;
    white-space: pre;
    margin: 10px;
}
.F {color: red;}
.X {color: blue;}
.rhs .F {position: relative; top: -5px;}
.lhs::after {content: "="; display: inline;}
.grouping::before {content: "("; display: inline;}
.grouping::after {content: ")"; display: inline;}
'''

if __name__ == '__main__':
    import sys
    args = dict(enumerate(sys.argv))
    fh = open(args[1], 'w') if args.get(1) else sys.stdout
    fh.write('<style>{}</style>'.format(styles))
    fh.write(fmt.format('hooks', replace(hooks)))
    fh.write(fmt.format('forks', replace(forks)))
