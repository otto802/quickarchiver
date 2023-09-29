class htmlSimpleTable {

    constructor() {

    }

    data = {};
    table = {};
    tableConfig = {};

    getData() {
        return this.data;
    }

    setData(data) {
        this.data = data;
    }

    getTableConfig() {
        return this.tableConfig;
    }

    setTableConfig(data) {
        this.tableConfig = data;
    }


    build() {

        this.renderTable();
        this.renderTableHeader();
        this.renderTableBody();

        return this.table;

    }


    renderTable() {

        let css_class = [];
        css_class.push("table");

        if (typeof (this.tableConfig.table) !== "undefined"
            && typeof (this.tableConfig.table.class) !== "undefined") {
            css_class.push(this.tableConfig.table.class);
        }

        let table = document.createElement("table");
        table.className = css_class.join(" ");

        this.table = table;
    }

    renderTableHeader() {

        let tHead = this.table.createTHead();
        let row = tHead.insertRow();
        for (let field of this.tableConfig.fields) {

            let th = document.createElement("th");

            if (field.class) {
                th.className = field.class;
            }
            if (field.width) {
                th.style = 'width:' + field.width;
            }

            let value = document.createTextNode(field.title ? field.title : field.field);
            th.appendChild(value);
            row.appendChild(th);
        }
    }

    renderTableBody() {

        let tbody = this.table.createTBody();

        for (let rowKey in this.data) {

            if (!this.data[rowKey]) {
                continue;
            }

            let rowData = this.data[rowKey];


            let row = this.table.insertRow();

            let css_class = "";

            if (typeof (this.tableConfig.table.rowHighlighter) !== "undefined") {
                css_class = this.tableConfig.table.rowHighlighter(rowKey, rowData);
            }

            row.className = css_class;

            for (let field of this.tableConfig.fields) {
                let cell = row.insertCell();

                let val = rowData[field.field];

                if (typeof (field.formatterField) !== "undefined") {
                    val = field.formatterField(val, rowKey);
                }

                if (typeof (field.formatterRow) !== "undefined") {
                    val = field.formatterRow(rowData);
                }

                let value = document.createTextNode(val);

                if (typeof (field.createChild) !== "undefined") {
                    value = field.createChild(val, rowKey);
                }

                cell.appendChild(value);
            }
        }

        /*
                foreach ($this->data as $rowKey => $row) {

                    $css_class = "";

                    if (is_array($this->render_config["table"]) && array_key_exists(
                        'row_highlighter',
                        $this->render_config["table"]
                    )) {

                        $class = $this->render_config["table"]['row_highlighter']($row);
                        if ($class) {
                            $css_class = $class;
                        }
                    }

                    if ($rowKey === count($this->data)-1 && isset($this->render_config["table"]['last_row']) && isset($this->render_config["table"]['last_row']['class'])){
                        $css_class .= " ". $this->render_config["table"]['last_row']['class'];
                    }


                    $output[] = sprintf(
                        '<tr%s>',
                        ($css_class ? ' class="' . $css_class . '"' : '')
                    );

                    foreach ($this->render_config["fields"] as $field) {

                        if (array_key_exists('default_formatter', $field)) {
                            $str = $field['default_formatter']($row[$field["field"]]);
                        } else {
                            $str = $row[$field["field"]];
                        }

                        if (array_key_exists('formatter_row', $field)) {
                            $str = $field['formatter_row']($row);
                        }
                        if (array_key_exists('formatter_row_key', $field)) {
                            $str = $field['formatter_row']($row, $rowKey);
                        }

                        if ($rowKey === count($this->data)-1 && isset($this->render_config["table"]['last_row']) && isset($this->render_config["table"]['last_row']['default_formatter'])){
                            $str = $this->render_config["table"]['last_row']['default_formatter']($row[$field["field"]]);
                        }

                        if (array_key_exists('cell_highlighter', $field)) {
                            $field["class"] .= " " . $field['cell_highlighter']($str, $row);
                        }

                        if ($field["cut"]) {
                            $str = cutstr($str, $field["cut"]);
                        }



                        $output[] = sprintf(
                            '<td%s%s>%s</td>',
                            ($field["style"] ? ' style="' . $field["style"] . '"' : ''),
                            ($field["class"] ? ' class="' . $field["class"] . '"' : ''),
                            $str

                        );
                    }

                    $output[] = '</tr>';
                }
                $output[] = '</tbody>';

                return $output;*/
    }

}