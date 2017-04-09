import React, { Component, PropTypes } from 'react';
import NavDropdown from 'react-bootstrap/lib/NavDropdown';
import MenuItem from 'react-bootstrap/lib/MenuItem';
import { Link } from 'react-scroll';

import LocaleFormattedMessage from 'components/LocaleFormattedMessage';
import { surahType } from 'types';

const style = require('./style.scss');

export default class VersesDropdown extends Component {
  static propTypes = {
    loadedVerses: PropTypes.instanceOf(Set).isRequired,
    chapter: surahType.isRequired, // Set
    onClick: PropTypes.func.isRequired,
    isReadingMode: PropTypes.bool,
    className: PropTypes.string
  };

  static defaultProps = {
    className: null
  };

  renderItem = (ayah, index) => {
    const { chapter, loadedVerses, isReadingMode, onClick } = this.props;
    const number = index + 1;

    if (loadedVerses.has(number) && !isReadingMode) {
      return (
        <li key={index}>
          <Link
            onClick={() => onClick(number)}
            to={`verse:${chapter.chapterNumber}:${number}`}
            smooth
            spy
            offset={-120}
            activeClass="active"
            duration={500}
            className="pointer"
          >
            {number}
          </Link>
        </li>
      );
    }

    return (
      <MenuItem key={index} onClick={() => onClick(number)}>
        {number}
      </MenuItem>
    );
  }

  renderMenu() {
    const { chapter } = this.props;
    const array = Array(chapter.versesCount).join().split(',');

    return array.map((ayah, index) => this.renderItem(ayah, index));
  }

  render() {
    const { className } = this.props;

    const title = (
      <LocaleFormattedMessage id={'setting.verses'} defaultMessage={'Go to verse'} />
    );

    return (
      <NavDropdown
        link
        className={`dropdown ${className} ${style.dropdown}`}
        id="verses-dropdown"
        title={title}
      >
        {this.renderMenu()}
      </NavDropdown>
    );
  }
}
