
const colors = ['#D55E00', '#E69F00', '#56B4E9'];

// numpy shape of (..., rows, cols)
// higher dims are prepended, not appended
// so (r1, c1, r0, c1)
// with an odd index we can either have (c1, r0, c1) or (r1, r0, c1)
// I think we stick to (c1, r0, c1) to
function draw_tensor(svg, dims, params) {
    // rect (s)ize, (m)argin, (m)argin (m)ultiplier, (r)ect (c)olor
    let {s, m, mm, rc} = (params ?? {});
    s ??= 30;
    m ??= 5;
    mm ??= 2;
    rc ??= '#f00';

    let f = Math.floor(calculate_fontsize(svg, s, dims.length) * 0.95);

    let last_dim_synthetic = false;

    // dims looks like
    // [row, col, ...]

    dims = dims.slice();
    if (dims.length % 2 === 1) {
        last_dim_synthetic = true;
        dims.splice(0, 0, 1); // (1, c1, ..., r0, c1)
        // whereas if we used (r1, r0, c1), we would do
        // dims.splice(1, 0, 1); // (c1, 1, ..., r0, c1)
    }
    // [col, row, ...]
    let dims_r = dims.slice();
    dims_r.reverse();

    // we have to calculate sizes from last pair of dims to first
    // we don't have the calculate the last size
    // [h, w, ...] (then gets reversed)
    let sizes = [];
    for (let i = 0; i < dims.length - 2; i += 2) {
        let level = Math.floor(i / 2);
        let cols = dims_r[i];
        let rows = dims_r[i + 1];
        let w = i == 0 ? s : sizes[sizes.length - 1];
        let h = i == 0 ? s : sizes[sizes.length - 2];
        let width = cols * w + (cols - 1) * m * Math.pow(mm, level);
        let height = rows * h + (rows - 1) * m * Math.pow(mm, level);
        sizes.push(height);
        sizes.push(width);
    }

    // [w, h, ...]
    sizes.reverse();

    // convert coords into string
    // coords: i0, j0, ... i0, j0
    function coords_s(coords, i, j) {
        if (coords.length == 0) {
            return last_dim_synthetic ? `${j}` : `${i}${j}`;
        }
        let s = '';
        for (let i = last_dim_synthetic ? 1: 0; i < coords.length; i++) {
            s += coords[i];
        }
        s += `${i}${j}`;
        return s;
    }

    function coords_append(coords, i, j) {
        let ret = coords.slice();
        ret.push(i);
        ret.push(j);
        return ret;
    }

    let group = svg_element('g', svg);
    // dims: rows, cols, ...
    // sizes: width, height, ...
    // coords i, j, ...
    function inner(dims, sizes, x, y, level, coords) {
        let rows = dims[0];
        let cols = dims[1];
        let width = sizes[0];
        let height = sizes[1];
        let mat = [];

        if (dims.length == 2) {
            for (let i = 0; i < rows; i++) {
                let row = [];
                for (let j = 0; j < cols; j++) {
                    let xx = x + j * (s + m * Math.pow(mm, level));
                    let yy = y + i * (s + m * Math.pow(mm, level));
                    let rect = svg_element('rect', group, {
                        width: s,
                        height: s,
                        stroke: rc,
                        x: xx,
                        y: yy,
                    })
                    let text = svg_element('text', group, {
                        x: xx + s/2,
                        y: yy + s/2 + f/3,
                        'font-size': f,
                    });
                    text.textContent = coords_s(coords, i, j);
                    row.push({rect, text});
                }
                mat.push(row);
            }
        } else {
            for (let i = 0; i < rows; i++) {
                let row = [];
                for (let j = 0; j < cols; j++) {
                    let dx = j * (width + m * Math.pow(mm, level));
                    let dy = i * (height + m * Math.pow(mm, level));
                    let arr = inner(dims.slice(2), sizes.slice(2), x + dx, y + dy, level - 1, coords_append(coords, i, j));
                    row.push(arr);
                }
                mat.push(row);
            }
        }
        return mat;
    }

    let mat = inner(dims, sizes, 0, 0, Math.floor(dims.length / 2) - 1, []);
    if (last_dim_synthetic) {
        mat = mat[0];
    }
    return [group, mat];
}

function shape_parse(s) {
    return s.split(',').map((x) => {
        try {
            let n = parseInt(x);
            if (n <= 0) {
                throw new Error(`Shape dim ${n} needs to be positive`);
            }
            return n;
        } catch {
            throw new Error(`Invalid shape`);
        }
    });
}

function einsum_parse(s, a_shape, b_shape) {
    const re = /([a-z]+),([a-z]+)->([a-z]+)/i;
    let match = re.exec(s);
    if (match == null) throw new Error(`could not parse '${s}'`)

    let [_, a, b, o] = match;

    if (a_shape.length != a.length) throw new Error(`Shape dim mismatch ${a} ${a_shape}`);
    if (b_shape.length != b.length) throw new Error(`Shape dim mismatch ${b} ${b_shape}`);

    function letters_of(s) {
        let ret = new Set();
        for (let i = 0; i < s.length; i++) {
            ret.add(s[i]);
        }
        return ret;
    }

    let a_letters = letters_of(a);
    let b_letters = letters_of(b);
    let o_letters = letters_of(o);
    let shared = a_letters.intersection(b_letters);

    if (shared.intersection(o_letters).length > 0) {
        throw new Error(`can't have shared letters in output`)
    }

    if (!o_letters.isSubsetOf(a_letters.union(b_letters))) {
        throw new Error(`output has letters not in the input`);
    }

    let dim_map = new Map();
    for (let [s, shape] of [[a, a_shape], [b, b_shape]]) {
        for (let i = 0; i < s.length; i++) {
            let v = dim_map.get(s[i]);
            if (v == null) {
                dim_map.set(s[i], shape[i]);
            } else if (v != shape[i]) {
                throw new Error(`Shape dim mismatch for ${shape}: expected axis ${i} to be of size ${v} but is ${shape[i]}`);
            }
        }
    }

    let out_shape = [];
    for (let i = 0; i < o.length; i++) {
        out_shape.push(dim_map.get(o[i]));
    }

    return { out_shape, dim_map, a, b, o, shared, }
}

function draw_widget(svg, a_shape, b_shape, ep, params) {
    let g = svg_element('g', svg, {
        // chrome wants to cut things off
        'transform': 'translate(2, 2)',
    });
    let [g1, a_cells] = draw_tensor(g, a_shape, {...params, rc: colors[0]});
    let [g2, b_cells] = draw_tensor(g, b_shape, {...params, rc: colors[1]});
    let [g3, o_cells] = draw_tensor(g, ep.out_shape, {...params, rc: colors[2]});
    // TIL you can't set `y` on g
    let spacing = 50;
    g2.setAttributeNS(null, 'transform', `translate(0, ${g1.getBBox().height + spacing})`);
    g3.setAttributeNS(null, 'transform', `translate(0, ${g1.getBBox().height + g2.getBBox().height + 2*spacing})`);

    svg.setAttributeNS(null, 'width', g.getBBox().width + 20);
    svg.setAttributeNS(null, 'height', g.getBBox().height + 20);

    let last_hovered = null;
    let first = true;

    svg.querySelectorAll('text').forEach((x) => {
        x.classList.add('hide');
    });

    function make_shared_text(text, shape_string, coords) {
        text.innerHTML = '';
        for (let i = 0; i < coords.length; i++) {
            let tspan = svg_element('tspan', text);
            if (ep.shared.has(shape_string[i])) {
                tspan.classList.add('shared-index');
            }
            tspan.textContent = coords[i];
        }
    }

    let binding = new Map();
    visit_tensor(o_cells, (coords, o_rect_text) => {
        binding.clear();
        for (let i = 0; i < ep.o.length; i++) {
            binding.set(ep.o[i], coords[i]);
        }
        let a_subst = substitute(binding, ep.a);
        let b_subst = substitute(binding, ep.b);

        let arr = [];
        visit_tensor_at(a_cells, a_subst, (coords, rect_text) => {
            arr.push(rect_text);
            make_shared_text(rect_text.text, ep.a, coords);
        });
        visit_tensor_at(b_cells, b_subst, (coords, rect_text) => {
            arr.push(rect_text);
            make_shared_text(rect_text.text, ep.b, coords);
        });

        const mouseenter = () => {
            if (last_hovered != null) {
                let {o_rect_text, arr} = last_hovered;
                o_rect_text.text.classList.add('hide');
                for (let {rect, text} of arr) {
                    text.classList.add('hide');
                }
            }

            o_rect_text.text.classList.remove('hide');
            for (let {rect, text} of arr) {
                text.classList.remove('hide');
            }
            last_hovered = {o_rect_text, arr};
        };
        o_rect_text.rect.addEventListener('mouseenter', mouseenter);
        if (first) {
            mouseenter();
            first = false;
        }
    });
}

const einsum_widget_html = `
<div class="controls">
    <label>Shape 1</label>
    <input type="text" name="shape1" size="8" />
    <label>Shape 2</label>
    <input type="text" name="shape2" size="8" />
    <label>Einsum Expression</label>
    <input type="text" name="einsum" size="16" />
    <button name="update">Update</button>
    <div>
        <label>Shape Out</label>
        <input type="text" name="shapeout" size="8" disabled="true" />
    </div>
</div>
<div class="error"></div>
<div class="svg-container"></div>
`;

export function make_einsum_widget(container, defaults) {
    container.innerHTML = einsum_widget_html

    let svg = svg_element('svg', container);

    let shape1_input = container.querySelector('input[name="shape1"]');
    let shape2_input = container.querySelector('input[name="shape2"]');
    let shapeout_input = container.querySelector('input[name="shapeout"]');
    let einsum_input = container.querySelector('input[name="einsum"]');
    let error_container = container.querySelector('.error');
    let update_button = container.querySelector('button');

    shape1_input.value = defaults.shape1.join(',');
    shape2_input.value = defaults.shape2.join(',');
    einsum_input.value = defaults.einsum;

    let params = {m: 10, s: 30, mm: 2, f: 10};

    const onChange = () => {
        error_container.innerText = '';
        svg.innerHTML = '';

        let a_shape, b_shape, ep;
        try {
            a_shape = shape_parse(shape1_input.value);
            b_shape = shape_parse(shape2_input.value);
            ep = einsum_parse(einsum_input.value, a_shape, b_shape);
        } catch(e) {
            console.error(e);
            error_container.innerText = e;
            return;
        }

        shapeout_input.value = ep.out_shape.join(',');

        draw_widget(svg, a_shape, b_shape, ep, params);

    };

    onChange();

    update_button.addEventListener('click', () => onChange());
}

const tensor_widget_html = `
<div class="controls">
    <label>Shape</label>
    <input type="text" name="shape" size="8" />
    <button name="update">Update</button>
</div>
<div class="error"></div>
<div class="svg-container"></div>
`;

export function make_tensor_widget(container, shape) {
    container.innerHTML = tensor_widget_html
    let svg = svg_element('svg', container);
    let shape_input = container.querySelector('input[name="shape"');
    let error_container = container.querySelector('.error');
    let update_button = container.querySelector('button');
    shape_input.value = shape.join(',');

    let params = {m: 10, s: 30, mm: 2, f: 10};
    const onChange = () => {
        error_container.innerText = '';
        svg.innerHTML = '';

        try {
            shape = shape_parse(shape_input.value);
        } catch(e) {
            console.error(e);
            error_container.innerText = e;
            return;
        }

        let [g, m] = draw_tensor(svg, shape, {...params, rc: colors[0]});

        g.setAttributeNS(null, 'transform', 'translate(2, 2)');
        svg.setAttributeNS(null, 'width', g.getBBox().width + 20);
        svg.setAttributeNS(null, 'height', g.getBBox().height + 20);
    };

    onChange();

    update_button.addEventListener('click', () => onChange());
}

function substitute(bindings, shape_string) {
    let ret = [];
    for (let i = 0; i < shape_string.length; i++) {
        ret.push(bindings.get(shape_string[i]) ?? shape_string[i]);
    }
    return ret;
}

function nested_for(dims, cb) {
    function coords_append(coords, i) {
        let ret = coords.slice();
        ret.push(i);
        return ret;
    }

    function go(dims, coords) {
        if (dims.length == 0) return;
        for (let i = 0; i < dims[0]; i++) {
            if (dims.length == 1) {
                cb(coords_append(coords, i));
            } else {
                go(dims.slice(1), coords_append(coords, i));
            }
        }
    }
    go(dims, []);
}

function visit_tensor(tensor, cb) {
    function coords_append(coords, i) {
        let ret = coords.slice();
        ret.push(i);
        return ret;
    }

    function go(tensor, coords) {
        if (!Array.isArray(tensor)) {
            return cb(coords, tensor);
        }
        for (let i = 0; i < tensor.length; i++) {
            go(tensor[i], coords_append(coords, i));
        }
    }
    go(tensor, []);
}

// at can be mix of integers and letters [0, 'a', 1]
// TODO this doesn't handle ['i', 'i'] currently
function visit_tensor_at(tensor, at, cb) {
    function coords_append(coords, i) {
        let ret = coords.slice();
        ret.push(i);
        return ret;
    }

    function go(tensor, at, coords) {
        if (!Array.isArray(tensor)) {
            return cb(coords, tensor);
        }
        if (typeof at[0] === 'string') {
            for (let i = 0; i < tensor.length; i++) {
                go(tensor[i], at.slice(1), coords_append(coords, i));
            }
        } else {
            let i = at[0]
            return go(tensor[i], at.slice(1), coords_append(coords, i));
        }
    }
    go(tensor, at, []);
}

function svg_element(tag, parent, attrs) {
    const svg_ns = 'http://www.w3.org/2000/svg';
    let x = document.createElementNS(svg_ns, tag);
    for (let [k, v] of Object.entries(attrs ?? {})) {
        x.setAttributeNS(null, k, v);
    }
    parent.appendChild(x);
    return x;
}

function calculate_fontsize(svg, size, n_letters) {
    let x = svg_element('text', svg, {'font-size': '10px'});
    for (let i = 0; i < n_letters; i++) {
        x.textContent += '0';
    }
    let bbox = x.getBBox();
    x.remove();
    return size / Math.max(bbox.width, bbox.height) * 10;
}
