/**
 * QuickArchiver
 * Copyright (c) 2023 Otto Berger <otto@bergerdata.de>
 *
 * QuickArchiver is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with QuickArchiver. If not, see <http://www.gnu.org/licenses/>.
 */


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

        try{
            this.renderTable();
            this.renderTableHeader();
            this.renderTableBody();

        } catch (e) {
            console.debug(e);
        }

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

            let value = document.createTextNode(typeof(field.title) !== "undefined" ? field.title : field.field);
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

            let row = tbody.insertRow();

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
                    value = field.createChild(rowData, rowKey);
                }

                if (typeof (field.cellCssClass) !== "undefined") {
                    cell.className = field.cellCssClass(rowData);
                }

                cell.appendChild(value);
            }
        }
    }
}