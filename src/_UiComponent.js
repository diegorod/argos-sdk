/* Copyright (c) 2010, Sage Software, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define('argos/_UiComponent', [
    'require',
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/_base/connect',
    'dojo/dom-construct',
    'dojo/dom-class',
    'dojo/Stateful',
    'dijit/_WidgetBase',
    'dijit/_Container',
    './_Component'
], function(
    require,
    declare,
    array,
    lang,
    connect,
    domConstruct,
    domClass,
    Stateful,
    _WidgetBase,
    _Container,
    _Component
) {
    /**
     * A specialized Component that provides:
     *
     * 1. Adds the resulting content as HTML and is appended to the DOM during the `render()` stage.
     * 2. Adds the following component definition properties:
     *
     *     {
     *         tag: 'string',
     *         attrs: {Object},
     *         content: 'string',
     *         domOnly: boolean
     *     }
     *
     * *tag*: makes this component a container node (using the node tag provided)
     *
     * *attrs*: adds the given attributes to the tag node
     *
     * *content*: instead of child components you can bypass it and do a straight string
     * HTML markup for the content
     *
     * *domOnly*: If true/undefined denotes that this should be treated as merely markup. If
     * false it will be treated as a Control/Widget with all the supporting features.
     *
     *
     * Note that if `type` is present then it will be considered a normal `_Component`.
     *
     * Examples of _UiComponent:
     *
     *     { name: 'content', tag: 'ul', attrs: {'class': 'list-content'}, attachPoint: 'contentNode' }
     *
     *     { name: 'more', content: Simplate.make('<button data-action="more">$.moreText</button>')}
     *
     * @alternateClassName _UiComponent
     * @extends _Component
     */
    var _UiComponent = declare('argos._UiComponent', [_Component], {
        _startupChildComponent: function(instance) {
            if (instance.isInstanceOf(_WidgetBase) && instance._started) return;

            instance.startup();
        },
        _destroyChildComponent: function(instance) {
            if (instance.isInstanceOf(_WidgetBase) && instance._beingDestroyed) return;

            instance.destroy();
        },
        _instantiateComponent: function(definition, root, owner) {
            if (definition.type) return this.inherited(arguments);
            if (definition.domOnly !== false)
            {
                var node = definition.content
                    ? domConstruct.toDom(
                        lang.isFunction(definition.content)
                            ? definition.content.call(this, root, owner, this)
                            : definition.content
                    )
                    : domConstruct.create(definition.tag, definition.attrs);

                return new DomContentComponent(lang.mixin({
                    components: definition.components,
                    _componentRoot: root,
                    _componentOwner: owner,
                    _componentSource: definition
                }, definition.props), node);
            }
            else
            {
                return new Control(lang.mixin({
                    components: definition.components,
                    content: definition.content,
                    attrs: definition.attrs,
                    tag: definition.tag,
                    _componentRoot: root,
                    _componentOwner: owner,
                    _componentSource: definition
                }, definition.props));
            }
        },
        _attachComponent: function(definition, instance, context, root, owner) {
            this.inherited(arguments);

            this._attachUiComponent(instance, context, definition && definition.position);
        },
        _detachComponent: function(instance, context, root, owner) {
            this.inherited(arguments);

            this._detachUiComponent(instance, context);
        },
        _attachUiComponent: function(instance, context, position) {
            var referenceNode = this.containerNode || this.domNode;

            if (instance.isInstanceOf(_WidgetBase))
            {
                if (this.isInstanceOf(_Container))
                    this.addChild(instance, position);
                else if (referenceNode)
                    instance.placeAt(instance.domNode == referenceNode ? this.domNode : referenceNode, position);
            }
            else if (instance.domNode)
            {
                domConstruct.place(instance.domNode, instance.domNode == referenceNode ? this.domNode : referenceNode, position);
            }
        },
        _detachUiComponent: function(instance, context) {
            if (instance.isInstanceOf(_WidgetBase))
            {
                if (this.isInstanceOf(_Container))
                    this.removeChild(instance);
                else if (instance.domNode && instance.domNode.parentNode)
                    instance.domNode.parentNode.removeChild(instance.domNode);
            }
            else if (instance.domNode && instance.domNode.parentNode)
            {
                instance.domNode.parentNode.removeChild(instance.domNode);
            }
        }
    });

    /**
     * DomContentComponent is a component that is just a holder for a DOM Node. When retrieving
     * the value, it merely returns the assigned node.
     *
     * @alternateClassName DomContentComponent
     * @extends _UiComponent
     */
    var DomContentComponent = declare('argos.DomContentComponent', [_UiComponent], {
        /**
         * @property {HTMLElement}
         * The assigned node of this component
         */
        domNode: null,
        constructor: function(props, node) {
            lang.mixin(this, props);

            this.domNode = node;
        },
        destroy: function() {
            if (this.domNode)
            {
                if (this.domNode.parentNode)
                    this.domNode.parentNode.removeChild(this.domNode);

                this.domNode = null;
            }

            this.inherited(arguments);
        },
        /**
         * Returns the assigned dom node.
         * @return {HTMLElement}
         */
        getComponentValue: function() {
            return this.domNode;
        }
    });

    /**
     * A lightweight widget-like component that incorporates [dojo/Stateful](http://dojotoolkit.org/reference-guide/1.8/dojo/Stateful.html)
     *
     * It also selectively adds functionality from dijit/_WidgetBase, namely get/set and placeAt.
     *
     * @alertnateClassName Control
     * @extends _UiComponent
     */
    var Control = declare('argos.Control', [Stateful, _UiComponent], {
        attributeMap: {},
        tag: null,
        attrs: null,
        content: null,
        baseClass: null,

        constructor: function(props) {
            this.params = props;
        },

        onCreate: function() {
            this.inherited(arguments);
            this.render();

            if (this.domNode) this._applyAttributes();
        },

        render: function() {
            if (this.domNode) return;

            if (this.content)
            {
                this.domNode = domConstruct.toDom(
                    lang.isFunction(this.content)
                        ? this.content.call(this, this._componentRoot, this._componentOwner, this)
                        : this.content
                );
            }
            else
            {
                this.domNode = domConstruct.create(this.tag || 'div', this.attrs);
            }

            this.containerNode = this.domNode;

            if (this.baseClass) domClass.add(this.domNode, this.baseClass);
        },

        remove: function() {
            if (this.domNode && this.domNode.parentNode)
                this.domNode.parentNode.removeChild(this.domNode);
        },

        destroy: function() {
            this.inherited(arguments);

            if (this.domNode && this.domNode.parentNode)
                this.domNode.parentNode.removeChild(this.domNode);

            this.domNode = this.containerNode = null;
        },

        /* selective mixin from _WidgetBase */
        placeAt: _WidgetBase.prototype.placeAt,
        set: _WidgetBase.prototype.set,
        get: _WidgetBase.prototype.get,
        _set: _WidgetBase.prototype._set,
        _attrToDom: _WidgetBase.prototype._attrToDom,
        _getAttrNames: _WidgetBase.prototype._getAttrNames,
        _attrPairNames: _WidgetBase.prototype._attrPairNames,
        _applyAttributes: _WidgetBase.prototype._applyAttributes
    });

    _UiComponent.DomContentComponent = DomContentComponent;
    _UiComponent.Control = Control;

    return _UiComponent;
});