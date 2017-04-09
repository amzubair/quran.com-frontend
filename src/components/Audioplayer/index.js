/* global document */
// TODO: This file is too too large.
import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { camelize } from 'humps';
import Loadable from 'react-loadable';

import LocaleFormattedMessage from 'components/LocaleFormattedMessage';

// Helpers
import debug from 'helpers/debug';
import scroller from 'utils/scroller';

import { surahType, segmentType, verseType } from 'types';

// Redux
import * as AudioActions from 'redux/actions/audioplayer';

import ComponentLoader from 'components/ComponentLoader';
import Track from './Track';
import Segments from './Segments';
import ScrollButton from './ScrollButton';

const style = require('./style.scss');

const RepeatDropdown = Loadable({
  loader: () => import('./RepeatDropdown'),
  LoadingComponent: ComponentLoader
});

export class Audioplayer extends Component {
  static propTypes = {
    className: PropTypes.string,
    chapter: surahType,
    onLoadAyahs: PropTypes.func.isRequired,
    segments: PropTypes.objectOf(segmentType),
    // NOTE: should be PropTypes.instanceOf(Audio) but not on server.
    files: PropTypes.object, // eslint-disable-line
    currentVerse: PropTypes.string,
    buildOnClient: PropTypes.func.isRequired,
    isLoadedOnClient: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
    play: PropTypes.func.isRequired,
    pause: PropTypes.func.isRequired,
    next: PropTypes.func.isRequired, // eslint-disable-line
    previous: PropTypes.func.isRequired, // eslint-disable-line
    update: PropTypes.func.isRequired,
    repeat: PropTypes.shape({
      from: PropTypes.number,
      to: PropTypes.number,
      time: PropTypes.number,
    }).isRequired,
    shouldScroll: PropTypes.bool.isRequired,
    setRepeat: PropTypes.func.isRequired,
    setAyah: PropTypes.func.isRequired,
    toggleScroll: PropTypes.func.isRequired,
    isPlaying: PropTypes.bool,
    currentTime: PropTypes.number,
    duration: PropTypes.number,
    // NOTE: should be PropTypes.instanceOf(Audio) but not on server.
    currentFile: PropTypes.any, // eslint-disable-line
    startVerse: verseType // eslint-disable-line
  };

  componentDidMount() {
    const { isLoadedOnClient, buildOnClient, chapter, currentFile } = this.props; // eslint-disable-line no-shadow, max-len

    debug('component:Audioplayer', 'componentDidMount');

    if (!isLoadedOnClient && __CLIENT__) {
      debug('component:Audioplayer', 'componentDidMount on client');

      return buildOnClient(chapter.chapterNumber);
    }

    if (currentFile) {
      return this.handleAddFileListeners(currentFile);
    }

    return false;
  }

  componentWillReceiveProps(nextProps) {
    // Make sure we have a current ayah to mount it to Audio
    if (!this.props.currentVerse && !nextProps.currentFile) {
      return false;
    }

    // When you go directly to the chapter page, /2, the files are not loaded yet
    if (this.props.isLoadedOnClient !== nextProps.isLoadedOnClient) {
      return this.handleAddFileListeners(nextProps.currentFile);
    }

    if (this.props.currentVerse !== nextProps.currentVerse) {
      this.handleAddFileListeners(nextProps.currentFile);

      if (this.props.currentFile) {
        this.handleRemoveFileListeneres(this.props.currentFile);
      }

      return false;
    }

    return false;
  }

  componentDidUpdate() {
    const { currentFile, isPlaying } = this.props;

    if (!currentFile) return false;

    if (isPlaying) {
      currentFile.play();
    } else {
      currentFile.pause();
    }

    return false;
  }

  componentWillUnmount() {
    const { files, currentFile } = this.props;
    debug('component:Audioplayer', 'componentWillUnmount');

    if (files[currentFile]) {
      return this.handleRemoveFileListeneres(files[currentFile]);
    }

    return false;
  }

  getPrevious() {
    const { currentVerse, files } = this.props;
    const ayahIds = Object.keys(files);
    const index = ayahIds.findIndex(id => id === currentVerse);

    return ayahIds[index - 1];
  }

  getNext() {
    const { currentVerse, chapter, files, onLoadAyahs } = this.props;
    const ayahIds = Object.keys(files);
    const ayahNum = currentVerse.split(':')[1];
    const index = ayahIds.findIndex(id => id === currentVerse);

    if (chapter.versesCount === ayahNum + 1) {
      // We are at the end of the chapter!
      return false;
    }

    if (ayahIds.length - 3 <= index + 1) {
      // Need to load the next set of ayahs!
      onLoadAyahs();
    }

    return ayahIds[index + 1];
  }

  handleAyahChange = (direction = 'next') => {
    const { isPlaying, play, pause, currentVerse } = this.props; // eslint-disable-line no-shadow, max-len
    const previouslyPlaying = isPlaying;

    if (isPlaying) pause();

    const nextVerse = this[camelize(`get_${direction}`)]();
    if (!nextVerse) return pause();

    this.props[direction](currentVerse);

    this.handleScrollTo(nextVerse);

    this.preloadNext();

    if (previouslyPlaying) play();

    return false;
  }

  scrollToVerse = (ayahNum = this.props.currentVerse) => {
    scroller.scrollTo(`verse:${ayahNum}`, -45);
  }

  handleScrollTo = (ayahNum) => {
    const { shouldScroll } = this.props;

    if (shouldScroll) {
      this.scrollToVerse(ayahNum);
    }
  }

  play = () => {
    this.handleScrollTo();

    this.props.play();
    this.preloadNext();
  }

  preloadNext() {
    const { currentVerse, files } = this.props;
    const ayahIds = Object.keys(files);
    const index = ayahIds.findIndex(id => id === currentVerse) + 1;

    for (let id = index; id <= index + 2; id += 1) {
      if (ayahIds[id]) {
        const verseKey = ayahIds[id];

        if (files[verseKey]) {
          files[verseKey].setAttribute('preload', 'auto');
        }
      }
    }
  }

  handleRepeat = (file) => {
    const {
      repeat,
      currentVerse,
      setRepeat, // eslint-disable-line no-shadow
      setAyah // eslint-disable-line no-shadow
    } = this.props;
    const [chapter, ayah] = currentVerse.split(':').map(val => parseInt(val, 10));

    file.pause();

    if (repeat.from > ayah && repeat.to < ayah) {
      // user selected a range where current ayah is outside
      return this.handleAyahChange();
    }

    if (repeat.from === repeat.to) {
      // user selected single ayah repeat
      if (ayah !== repeat.from) return this.handleAyahChange();

      if (repeat.times === 1) {
        // end of times
        setRepeat({});

        return this.handleAyahChange();
      }

      setRepeat({ ...repeat, times: repeat.times - 1 });
      file.currentTime = 0; // eslint-disable-line no-param-reassign

      return file.play();
    }

    if (repeat.from !== repeat.to) {
      // user selected a range
      if (ayah < repeat.to) {
        // still in range
        return this.handleAyahChange();
      }

      if (ayah === repeat.to) {
        // end of range
        if (repeat.times === 1) {
          // end of times
          setRepeat({});

          return this.handleAyahChange();
        }

        setRepeat({ ...repeat, times: repeat.times - 1 });
        setAyah(`${chapter}:${repeat.from}`);

        return this.play();
      }
    }

    return false;
  }

  handleScrollToggle = (event) => {
    event.preventDefault();

    const { shouldScroll, currentVerse } = this.props;

    if (!shouldScroll) { // we use the inverse (!) here because we're toggling, so false is true
      this.scrollToVerse(currentVerse);
    }

    this.props.toggleScroll();
  }

  handleAddFileListeners(file) {
    // NOTE: if no file, just wait.
    if (!file) return false;

    const { update, currentTime } = this.props; // eslint-disable-line no-shadow
    debug('component:Audioplayer', `Attaching listeners to ${file.src}`);

    // Preload file
    file.setAttribute('preload', 'auto');

    const onLoadeddata = () => {
      // Default current time to zero. This will change
      file.currentTime = ( // eslint-disable-line no-param-reassign
        file.currentTime ||
        currentTime ||
        0
      );

      return update({
        duration: file.duration,
        isLoading: false
      });
    };

    const onTimeupdate = () => update({
      currentTime: file.currentTime,
      duration: file.duration
    });

    const onEnded = () => {
      const { repeat } = this.props;

      if (repeat.from) {
        return this.handleRepeat(file);
      }

      if (file.readyState >= 3 && file.paused) {
        file.pause();
      }

      return this.handleAyahChange();
    };

    const onPlay = () => {
      file.ontimeupdate = onTimeupdate; // eslint-disable-line no-param-reassign
    };

    const onPause = () => {
      file.ontimeupdate = null; // eslint-disable-line no-param-reassign
    };

    file.onloadeddata = onLoadeddata;  // eslint-disable-line no-param-reassign
    file.onpause = onPause; // eslint-disable-line no-param-reassign
    file.onplay = onPlay; // eslint-disable-line no-param-reassign
    file.onended = onEnded; // eslint-disable-line no-param-reassign

    return file;
  }

  handleRemoveFileListeneres = (file) => {
    file.pause();
    file.currentTime = 0; // eslint-disable-line no-param-reassign
    file.onloadeddata = null; // eslint-disable-line no-param-reassign
    file.ontimeupdate = null; // eslint-disable-line no-param-reassign
    file.onplay = null; // eslint-disable-line no-param-reassign
    file.onPause = null; // eslint-disable-line no-param-reassign
    file.onended = null; // eslint-disable-line no-param-reassign
    file.onprogress = null; // eslint-disable-line no-param-reassign
  }

  handleTrackChange = (fraction) => {
    const { currentFile, update } = this.props; // eslint-disable-line no-shadow

    update({
      currentTime: fraction * currentFile.duration
    });

    currentFile.currentTime = fraction * currentFile.duration;
  }

  renderPlayStopButtons() {
    const { isPlaying, pause } = this.props; // eslint-disable-line no-shadow

    return (
      <a
        tabIndex="-1"
        className={`pointer text-center ${style.playingButton} ${style.buttons}`}
        onClick={isPlaying ? pause : this.play}
      >
        <i className={`ss-icon ${isPlaying ? 'ss-pause' : 'ss-play'}`} />
      </a>
    );
  }

  renderPreviousButton() {
    const { currentVerse, files } = this.props;
    if (!files) return false;
    const index = Object.keys(files).findIndex(id => id === currentVerse);

    return (
      <a
        tabIndex="-1"
        className={`pointer ${style.buttons} ${!index ? style.disabled : ''}`}
        onClick={() => index && this.handleAyahChange('previous')}
      >
        <i className="ss-icon ss-skipback" />
      </a>
    );
  }

  renderNextButton() {
    const { chapter, currentVerse } = this.props;
    if (!chapter) return false;
    const isEnd = chapter.versesCount === parseInt(currentVerse.split(':')[1], 10);

    return (
      <a
        tabIndex="-1"
        className={`pointer ${style.buttons} ${isEnd ? style.disabled : ''}`}
        onClick={() => !isEnd && this.handleAyahChange()}
      >
        <i className="ss-icon ss-skipforward" />
      </a>
    );
  }

  render() {
    debug('component:Audioplayer', 'render');

    const {
      className,
      segments,
      isLoading,
      currentVerse,
      currentFile,
      currentTime,
      duration,
      chapter,
      isPlaying,
      isLoadedOnClient,
      repeat, // eslint-disable-line no-shadow
      shouldScroll, // eslint-disable-line no-shadow
      setRepeat // eslint-disable-line no-shadow
    } = this.props;

    if (isLoading || !currentFile) {
      return (
        <li className={`${style.container} ${className}`}>
          <div>
            <LocaleFormattedMessage
              id="app.loading"
              defaultMessage="Loading..."
            />
          </div>
        </li>
      );
    }

    return (
      <div className={`${isPlaying && style.isPlaying} ${style.container} ${className}`}>
        <div className={style.wrapper}>
          {isLoadedOnClient ?
            <Track
              progress={(currentTime / duration) * 100}
              onTrackChange={this.handleTrackChange}
            /> : null}
          {
            isLoadedOnClient &&
            segments &&
            segments[currentVerse] &&
            segments[currentVerse] &&
              <Segments
                segments={segments[currentVerse]}
                currentVerse={currentVerse}
                currentTime={currentTime}
              />
          }
        </div>
        <ul className={`list-inline ${style.controls}`}>
          <li className={style.controlItem}>
            <LocaleFormattedMessage
              id="player.currentVerse"
              defaultMessage="Ayah"
            />: {currentVerse.split(':')[1]}
          </li>
          <li className={style.controlItem}>
            {this.renderPreviousButton()}
          </li>
          <li className={style.controlItem}>
            {this.renderPlayStopButtons()}
          </li>
          <li className={style.controlItem}>
            {this.renderNextButton()}
          </li>
          <li className={style.controlItem}>
            <RepeatDropdown
              repeat={repeat}
              setRepeat={setRepeat}
              current={parseInt(currentVerse.split(':')[1], 10)}
              chapter={chapter}
            />
          </li>
          <li className={style.controlItem}>
            <ScrollButton shouldScroll={shouldScroll} onScrollToggle={this.handleScrollToggle} />
          </li>
        </ul>
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  const currentVerse = state.audioplayer.currentVerse || ownProps.startVerse.verseKey;
  const files = state.audioplayer.files[ownProps.chapter.id];

  return {
    files,
    currentVerse,
    segments: state.audioplayer.segments[ownProps.chapter.id],
    currentFile: files[currentVerse],
    chapterId: ownProps.chapter.id,
    isPlaying: state.audioplayer.isPlaying,
    isLoadedOnClient: state.audioplayer.isLoadedOnClient,
    isLoading: state.audioplayer.isLoading,
    repeat: state.audioplayer.repeat,
    shouldScroll: state.audioplayer.shouldScroll,
    duration: state.audioplayer.duration,
    currentTime: state.audioplayer.currentTime,
  };
};

export default connect(mapStateToProps, AudioActions)(Audioplayer);
